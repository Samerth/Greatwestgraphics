#!/usr/bin/env bash
# Loads Great West Graphics' OpenAI API key into the web JSON secret and
# switches the Design Studio's AI Art panel onto it.
#
# The key is read with a silent prompt and never echoed, logged or written
# anywhere but Secrets Manager. It goes on the web service only: the AI Art
# routes (/api/studio/identity, /api/studio/remove-background) run in the
# Next.js tier and call OpenAI directly; commerce-api has no use for it.
#
#   export CONFIG_FILE=config.staging.env
#   ./scripts/25-set-openai-secret.sh
#
# What it sets on the web task definition:
#   OPENAI_API_KEY        secret, from the web JSON secret
#   STUDIO_AI_PROVIDER    plain env, "openai" - flips the panel to the paid model
#   OPENAI_IMAGE_MODEL    plain env, optional - defaults to the model in
#                         lib/commerce/studio-ai-provider.ts when unset
#
# Re-running with an existing key asks whether to replace it. To switch the
# panel back to the free generator without touching the key, set
# STUDIO_AI_PROVIDER=flux on the task definition (or remove it).
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state WEB_SECRET_ARN
for command_name in aws jq python3; do require_command "$command_name"; done

WEB_SECRET_NAME="$NAME_PREFIX/web"
CLUSTER="${ECS_CLUSTER:-$NAME_PREFIX}"
IMAGE_MODEL="${OPENAI_IMAGE_MODEL:-}"

merge_secret_key() {
  local secret_id="$1" key="$2" value="$3" current updated
  current="$(aws secretsmanager get-secret-value --secret-id "$secret_id" --query SecretString --output text)"
  updated="$(jq -c --arg key "$key" --arg value "$value" '.[$key]=$value' <<< "$current")"
  aws secretsmanager put-secret-value --secret-id "$secret_id" --secret-string "$updated" >/dev/null
  unset current updated
}

EXISTING="$(aws secretsmanager get-secret-value --secret-id "$WEB_SECRET_NAME" --query SecretString --output text | jq -r '.OPENAI_API_KEY // empty')"
if [[ -n "$EXISTING" ]]; then
  echo "OPENAI_API_KEY is already stored in $WEB_SECRET_NAME."
  read -r -p "Replace it? [y/N] " replace
  if [[ "${replace,,}" != "y" ]]; then
    echo "Keeping the existing key."
    OPENAI_KEY=""
  fi
fi
unset EXISTING

if [[ -z "${OPENAI_KEY+x}" || -n "${replace:-}" && "${replace,,}" == "y" ]]; then
  read -r -s -p "Paste the OpenAI API key (input is hidden): " OPENAI_KEY
  echo
  if [[ -z "$OPENAI_KEY" || "$OPENAI_KEY" != sk-* ]]; then
    echo "That does not look like an OpenAI key (they start with sk-). Nothing written." >&2
    exit 1
  fi
  echo "Writing OPENAI_API_KEY into $WEB_SECRET_NAME..."
  merge_secret_key "$WEB_SECRET_NAME" OPENAI_API_KEY "$OPENAI_KEY"
  unset OPENAI_KEY
fi

# Attaches the secret reference and the plain environment switches to the
# web task definition in one new revision, then rolls the service.
python3 - "$NAME_PREFIX-web" "$WEB_SECRET_ARN" "$CLUSTER" "$AWS_REGION" "$IMAGE_MODEL" <<'PY'
import json, subprocess, sys

family, secret_arn, cluster, region, image_model = sys.argv[1:6]
raw = subprocess.check_output(
    ["aws", "ecs", "describe-task-definition", "--task-definition", family, "--region", region],
    text=True,
)
td = json.loads(raw)["taskDefinition"]
container = td["containerDefinitions"][0]

secrets = container.setdefault("secrets", [])
if not any(item.get("name") == "OPENAI_API_KEY" for item in secrets):
    secrets.append({"name": "OPENAI_API_KEY", "valueFrom": f"{secret_arn}:OPENAI_API_KEY::"})

env = container.setdefault("environment", [])
def put(name, value):
    for item in env:
        if item.get("name") == name:
            item["value"] = value
            return
    env.append({"name": name, "value": value})
put("STUDIO_AI_PROVIDER", "openai")
if image_model:
    put("OPENAI_IMAGE_MODEL", image_model)

for k in (
    "taskDefinitionArn", "revision", "status", "requiresAttributes",
    "compatibilities", "registeredAt", "registeredBy", "deregisteredAt",
):
    td.pop(k, None)
path = "/tmp/gwg-td-openai.json"
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
print(f"Attached OPENAI_API_KEY and STUDIO_AI_PROVIDER=openai on {family}")
PY

echo
echo "Wait until the web service's pending count is 0, then open the Design"
echo "Studio's AI Art panel on the site and generate one design. The reply"
echo "header X-Studio-Ai-Provider: openai confirms the paid model answered."
