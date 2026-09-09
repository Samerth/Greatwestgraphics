#!/usr/bin/env bash
# Generates (or reuses) CODCHAT_LOOKUP_API_TOKEN, writes it into both the
# web and API JSON secrets, and attaches it to both running ECS task
# definitions.
#
# It goes on both services on purpose: CodChat's connector calls the web
# app's public /api/codchat/order-status relay (commerce-api itself has no
# public address — see the README's ECS section), which forwards the same
# request to the private commerce API's own /v1/codchat/order-status. Both
# sides check this one shared value independently.
#
#   export CONFIG_FILE=config.staging.env
#   ./scripts/23-set-codchat-secret.sh
#
# Prints the token once, at the end — copy it straight into CodCRM's Data
# sources screen as the Order Status connector's bearer credential. Re-running
# this script reuses whatever value is already stored rather than rotating it
# silently, since a surprise rotation would make the connector start failing
# with no obvious cause. To rotate deliberately, remove the key from both
# secrets first (or edit this script's reuse check), then re-run.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state WEB_SECRET_ARN API_SECRET_ARN
for command_name in aws jq python3; do require_command "$command_name"; done

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

EXISTING_TOKEN="$(aws secretsmanager get-secret-value --secret-id "$API_SECRET_NAME" --query SecretString --output text | jq -r '.CODCHAT_LOOKUP_API_TOKEN // empty')"
if [[ -n "$EXISTING_TOKEN" ]]; then
  echo "CODCHAT_LOOKUP_API_TOKEN already exists in $API_SECRET_NAME; reusing it."
  CODCHAT_TOKEN="$EXISTING_TOKEN"
else
  CODCHAT_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  echo "Generated a new CODCHAT_LOOKUP_API_TOKEN."
fi
unset EXISTING_TOKEN

echo "Writing CODCHAT_LOOKUP_API_TOKEN into $API_SECRET_NAME and $WEB_SECRET_NAME..."
merge_secret_key "$API_SECRET_NAME" CODCHAT_LOOKUP_API_TOKEN "$CODCHAT_TOKEN"
merge_secret_key "$WEB_SECRET_NAME" CODCHAT_LOOKUP_API_TOKEN "$CODCHAT_TOKEN"

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
path = "/tmp/gwg-td-codchat.json"
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

attach_secret "$NAME_PREFIX-api" CODCHAT_LOOKUP_API_TOKEN "${API_SECRET_ARN}:CODCHAT_LOOKUP_API_TOKEN::"
attach_secret "$NAME_PREFIX-web" CODCHAT_LOOKUP_API_TOKEN "${WEB_SECRET_ARN}:CODCHAT_LOOKUP_API_TOKEN::"

echo
echo "Wait until web+api pending is 0, then hard-refresh."
echo "Paste this exact value into CodCRM's Data sources screen as the"
echo "Order Status connector's bearer credential. Do not paste it anywhere"
echo "else, and do not log this output anywhere it will be retained:"
echo "  $CODCHAT_TOKEN"
unset CODCHAT_TOKEN
