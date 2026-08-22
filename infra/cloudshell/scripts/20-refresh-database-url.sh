#!/usr/bin/env bash
# Rewrite $NAME_PREFIX/api DATABASE_URL from the live RDS master-user secret
# and bounce the API tasks so they pick it up.
#
# 08-create-app-secrets.sh writes DATABASE_URL once. RDS
# --manage-master-user-password rotates afterwards. ECS then connects with
# the stale password and Postgres answers 28P01 (auth_failed) — which the
# staff inbox surfaces as "An unexpected error occurred".
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state DB_INSTANCE_ID DB_SG_ID CURRENT_ALLOWED_CIDR
for command_name in aws jq docker curl; do require_command "$command_name"; done

API_SECRET_NAME="$NAME_PREFIX/api"
CLUSTER="${ECS_CLUSTER:-$NAME_PREFIX}"

sync_rds_master_secret
TARGET_DATABASE_URL="$(rds_database_url)"
export TARGET_DATABASE_URL

CLOUDSHELL_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '\r\n')"
[[ "$CLOUDSHELL_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || {
  echo "Could not determine the CloudShell public IPv4 address." >&2
  exit 1
}
CLOUDSHELL_CIDR="$CLOUDSHELL_IP/32"
TEMP_RULE_ADDED=false

cleanup() {
  unset TARGET_DATABASE_URL DATABASE_URL
  if [[ "$TEMP_RULE_ADDED" == "true" ]]; then
    aws ec2 revoke-security-group-ingress --group-id "$DB_SG_ID" --protocol tcp \
      --port 5432 --cidr "$CLOUDSHELL_CIDR" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$CLOUDSHELL_CIDR" != "$CURRENT_ALLOWED_CIDR" ]]; then
  authorize_postgres_cidr "$DB_SG_ID" "$CLOUDSHELL_CIDR" "Temporary CloudShell DATABASE_URL refresh"
  TEMP_RULE_ADDED=true
fi

docker pull postgres:16-alpine >/dev/null
echo "Probing Postgres with the RDS master-user secret (must not be 28P01)..."
docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine \
  sh -c 'psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT current_user || '"'"' @ '"'"' || current_database();"'

if ! aws secretsmanager describe-secret --secret-id "$API_SECRET_NAME" >/dev/null 2>&1; then
  echo "API secret $API_SECRET_NAME does not exist. Run 08-create-app-secrets.sh first." >&2
  exit 1
fi

CURRENT_JSON="$(aws secretsmanager get-secret-value --secret-id "$API_SECRET_NAME" --query SecretString --output text)"
NEW_JSON="$(jq -c --arg url "$TARGET_DATABASE_URL" '.DATABASE_URL=$url' <<< "$CURRENT_JSON")"
aws secretsmanager put-secret-value --secret-id "$API_SECRET_NAME" --secret-string "$NEW_JSON" >/dev/null
unset CURRENT_JSON NEW_JSON TARGET_DATABASE_URL
echo "Updated $API_SECRET_NAME DATABASE_URL from the RDS master-user secret."

echo "Rolling $NAME_PREFIX-api on $CLUSTER so tasks load the new secret..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$NAME_PREFIX-api" \
  --force-new-deployment \
  --query 'service.{name:serviceName,desired:desiredCount,running:runningCount,pending:pendingCount}' \
  --output table

echo
echo "Wait until pending is 0, then hard-refresh Admin → Jobs."
echo "  aws ecs describe-services --cluster $CLUSTER --services $NAME_PREFIX-api \\"
echo "    --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount,pending:pendingCount}'"
echo "Do not db:seed. Do not print DATABASE_URL."
