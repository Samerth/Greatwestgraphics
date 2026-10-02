#!/usr/bin/env bash
# Stores the login e-mail Bulk Data should use (SANMAR_BULK_LOGIN_EMAIL) in this
# environment's vendor secret and attaches it to the running API task.
#
# Why a separate setting: on 1 Oct 2026 Bulk Data refused the shop's general
# inbox (the SANMAR_LOGIN_EMAIL every other SanMar call uses) and returned the
# full catalogue for the individual login SanMar's own working test used. This
# keeps that login scoped to Bulk only, rather than swapping the login for
# Product Data, Inventory, Pricing and Media, which have not been proven with it.
#
# The e-mail is a login credential: it is read hidden, never echoed, never
# printed, and goes only into AWS Secrets Manager. Do not send it to SanMar or
# anyone else by e-mail or screenshot.
#
#   export CONFIG_FILE=config.staging.env
#   bash 29-set-sanmar-bulk-login.sh
#
# The running API image only reads this setting once the branch containing
# `bulkLoginEmail` is deployed; until then it is stored and ignored, which is
# harmless. Staging only unless CONFIG_FILE points elsewhere on purpose.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state VENDOR_SECRET_ARN
for command_name in aws jq python3; do require_command "$command_name"; done

CLUSTER="${ECS_CLUSTER:-$NAME_PREFIX}"

read -r -s -p "SanMar Bulk login e-mail (the individual login, hidden): " BULK_LOGIN; echo
if [[ -z "$BULK_LOGIN" || "$BULK_LOGIN" != *@*.* ]]; then
  echo "That does not look like an e-mail address." >&2
  exit 2
fi

current="$(aws secretsmanager get-secret-value --secret-id "$VENDOR_SECRET_ARN" --query SecretString --output text)"
updated="$(jq -c --arg value "$BULK_LOGIN" '.SANMAR_BULK_LOGIN_EMAIL=$value' <<< "$current")"
aws secretsmanager put-secret-value --secret-id "$VENDOR_SECRET_ARN" --secret-string "$updated" >/dev/null
unset current updated BULK_LOGIN
echo "Stored SANMAR_BULK_LOGIN_EMAIL in $VENDOR_SECRET_ARN"

python3 - "$NAME_PREFIX-api" SANMAR_BULK_LOGIN_EMAIL "${VENDOR_SECRET_ARN}:SANMAR_BULK_LOGIN_EMAIL::" "$CLUSTER" "$AWS_REGION" <<'PY'
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
for k in ("taskDefinitionArn", "revision", "status", "requiresAttributes",
          "compatibilities", "registeredAt", "registeredBy", "deregisteredAt"):
    td.pop(k, None)
path = "/tmp/gwg-td-bulk-login.json"
open(path, "w").write(json.dumps(td))
reg = subprocess.check_output(
    ["aws", "ecs", "register-task-definition", "--cli-input-json", f"file://{path}", "--region", region],
    text=True,
)
arn = json.loads(reg)["taskDefinition"]["taskDefinitionArn"]
subprocess.check_call([
    "aws", "ecs", "update-service", "--cluster", cluster, "--service", family,
    "--task-definition", arn, "--force-new-deployment", "--region", region,
    "--query", "service.serviceName", "--output", "text",
])
print(f"Attached {env_name} on {family}")
PY

echo
echo "Done. $NAME_PREFIX-api picks it up once its new task is running"
echo "(check with 22-wait-ecs.sh - pending should return to 0)."
echo "Remember: Bulk allows ONE successful call per day. Today's call was used by"
echo "the test run; the app's own Bulk refresh will work from tomorrow."
