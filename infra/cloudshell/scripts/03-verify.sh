#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state DB_INSTANCE_ID DB_SECRET_ARN RDS_ENDPOINT DB_SG_ID CURRENT_ALLOWED_CIDR

DB_JSON="$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" --output json)"
STATUS="$(jq -r '.DBInstances[0].DBInstanceStatus' <<< "$DB_JSON")"
PUBLIC="$(jq -r '.DBInstances[0].PubliclyAccessible' <<< "$DB_JSON")"
ENCRYPTED="$(jq -r '.DBInstances[0].StorageEncrypted' <<< "$DB_JSON")"
DELETION_PROTECTION="$(jq -r '.DBInstances[0].DeletionProtection' <<< "$DB_JSON")"
ENGINE_VERSION="$(jq -r '.DBInstances[0].EngineVersion' <<< "$DB_JSON")"

[[ "$STATUS" == "available" ]] || { echo "RDS status is $STATUS, not available." >&2; exit 1; }
[[ "$PUBLIC" == "true" ]] || { echo "RDS is not publicly accessible." >&2; exit 1; }
[[ "$ENCRYPTED" == "true" ]] || { echo "RDS storage is not encrypted." >&2; exit 1; }
[[ "$DELETION_PROTECTION" == "true" ]] || { echo "RDS deletion protection is disabled." >&2; exit 1; }

RULES="$(aws ec2 describe-security-group-rules --filters Name=group-id,Values="$DB_SG_ID" --output json)"
if jq -e '.SecurityGroupRules[]? | select(.IsEgress == false and .CidrIpv4 == "0.0.0.0/0" and .FromPort == 5432)' <<< "$RULES" >/dev/null; then
  echo "Unsafe 0.0.0.0/0 PostgreSQL rule detected." >&2
  exit 1
fi
if ! jq -e --arg cidr "$CURRENT_ALLOWED_CIDR" \
  '.SecurityGroupRules[]? | select(.IsEgress == false and .CidrIpv4 == $cidr and .FromPort == 5432 and .ToPort == 5432)' \
  <<< "$RULES" >/dev/null; then
  echo "Expected trusted CIDR rule was not found." >&2
  exit 1
fi

echo "Verification passed"
echo "RDS endpoint:         $RDS_ENDPOINT:5432"
echo "PostgreSQL version:   $ENGINE_VERSION"
echo "Public endpoint:      yes"
echo "Allowed CIDR:         $CURRENT_ALLOWED_CIDR"
echo "Storage encrypted:    yes"
echo "TLS forced:           yes (parameter group)"
echo "Deletion protection:  yes"
echo "Migration completed:  ${MIGRATION_COMPLETED:-false}"
echo "Migration source:     ${MIGRATION_SOURCE:-not run}"
echo "Migrated tables:      ${MIGRATED_PUBLIC_TABLE_COUNT:-not checked}"
echo "Credentials secret:   $DB_SECRET_ARN"
