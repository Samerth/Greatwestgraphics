#!/usr/bin/env bash
# Put Stripe test keys into the existing staging/prod JSON secrets and attach
# them to the running ECS task definitions.
#
# Do not commit keys. Export them in CloudShell, then run this script:
#
#   export CONFIG_FILE=config.staging.env
#   export STRIPE_SECRET_KEY='sk_test_...'
#   export STRIPE_WEBHOOK_SECRET='whsec_...'
#   ./scripts/21-set-stripe-secrets.sh
#
# SITE_BASE_URL is already the API task's SITE_URL (CloudFront / SITE_HOSTNAME).
# ADMIN_API_TOKEN must stay the existing admin secret — do not mint a second one.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state WEB_SECRET_ARN API_SECRET_ARN
for command_name in aws jq python3; do require_command "$command_name"; done

[[ "${STRIPE_SECRET_KEY:-}" == sk_test_* ]] || {
  echo "Export STRIPE_SECRET_KEY as a sk_test_... value (not sk_live_ on staging)." >&2
  exit 1
}
[[ "${STRIPE_WEBHOOK_SECRET:-}" == whsec_* ]] || {
  echo "Export STRIPE_WEBHOOK_SECRET as a whsec_... value." >&2
  exit 1
}

WEB_SECRET_NAME="$NAME_PREFIX/web"
API_SECRET_NAME="$NAME_PREFIX/api"
CLUSTER="${ECS_CLUSTER:-$NAME_PREFIX}"

merge_secret_key() {
  local secret_id="$1" key="$2" value="$3" current updated
  current="$(aws secretsmanager get-secret-value --secret-id "$secret_id" --query SecretString --output text)"
  updated="$(jq -c --arg key "$key" --arg value "$value" '.[$key]=$value' <<< "$current")"
  aws secretsmanager put-secret-value --secret-id "$secret_id" --secret-string "$updated" >/dev/null
  unset current updated
}

echo "Writing Stripe keys into $API_SECRET_NAME and $WEB_SECRET_NAME..."
merge_secret_key "$API_SECRET_NAME" STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY"
merge_secret_key "$WEB_SECRET_NAME" STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET"
unset STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET

attach_secret() {
  local family="$1" env_name="$2" value_from="$3"
  python3 - "$family" "$env_name" "$value_from" "$CLUSTER" "$AWS_REGION" <<'PY'
import json, subprocess, sys

family, env_name, value_from, cluster, region = sys.argv[1:6]
raw = subprocess.check_output(
    ["aws", "ecs", "describe-task-definition", "--task-definition", family, "--region", region],
    text=True,
)
td = json.loads(raw)["taskDefinition"]
container = td["containerDefinitions"][0]
secrets = container.setdefault("secrets", [])
if any(item.get("name") == env_name for item in secrets):
    print(f"{family} already injects {env_name}")
    raise SystemExit(0)
secrets.append({"name": env_name, "valueFrom": value_from})
for k in (
    "taskDefinitionArn", "revision", "status", "requiresAttributes",
    "compatibilities", "registeredAt", "registeredBy", "deregisteredAt",
):
    td.pop(k, None)
path = "/tmp/gwg-td-stripe.json"
open(path, "w").write(json.dumps(td))
reg = subprocess.check_output(
    ["aws", "ecs", "register-task-definition", "--cli-input-json", f"file://{path}", "--region", region],
    text=True,
)
arn = json.loads(reg)["taskDefinition"]["taskDefinitionArn"]
subprocess.check_call(
    [
        "aws", "ecs", "update-service",
        "--cluster", cluster,
        "--service", family,
        "--task-definition", arn,
        "--force-new-deployment",
        "--region", region,
        "--query", "service.serviceName",
        "--output", "text",
    ]
)
print(f"Attached {env_name} on {family}")
PY
}

attach_secret "$NAME_PREFIX-api" STRIPE_SECRET_KEY "${API_SECRET_ARN}:STRIPE_SECRET_KEY::"
attach_secret "$NAME_PREFIX-web" STRIPE_WEBHOOK_SECRET "${WEB_SECRET_ARN}:STRIPE_WEBHOOK_SECRET::"

echo
echo "SITE_BASE_URL is already on the API as SITE_URL:"
echo "  ${SITE_URL:-unset}"
echo "Point the Stripe webhook at:"
echo "  ${SITE_URL:-https://YOUR_CLOUDFRONT}/api/stripe/webhook"
echo
if [[ -n "${ADMIN_TOKEN_SECRET_ARN:-}" ]]; then
  echo "Reuse the existing ADMIN_API_TOKEN (do not create a second one):"
  echo "  aws secretsmanager get-secret-value --secret-id \"$ADMIN_TOKEN_SECRET_ARN\" --query SecretString --output text | jq -r .ADMIN_API_TOKEN"
else
  echo "ADMIN_TOKEN_SECRET_ARN is not in state. If admin already works, the token is already on the tasks — do not replace it."
fi
echo
echo "Wait until web+api pending is 0, then hard-refresh. Do not print secret values."
