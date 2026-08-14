#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state DB_SG_ID CURRENT_ALLOWED_CIDR
[[ "$PUBLIC_DB_ALLOWED_CIDR" != "0.0.0.0/0" ]] || {
  echo "Refusing to expose PostgreSQL to 0.0.0.0/0." >&2
  exit 1
}
[[ "$PUBLIC_DB_ALLOWED_CIDR" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]] || {
  echo "PUBLIC_DB_ALLOWED_CIDR must be a valid IPv4 CIDR." >&2
  exit 1
}

if [[ "$PUBLIC_DB_ALLOWED_CIDR" == "$CURRENT_ALLOWED_CIDR" ]]; then
  echo "Allowed CIDR is already $CURRENT_ALLOWED_CIDR; no change needed."
  exit 0
fi

authorize_postgres_cidr "$DB_SG_ID" "$PUBLIC_DB_ALLOWED_CIDR" "Trusted external PostgreSQL client"
aws ec2 revoke-security-group-ingress --group-id "$DB_SG_ID" --protocol tcp --port 5432 \
  --cidr "$CURRENT_ALLOWED_CIDR" >/dev/null
save_state CURRENT_ALLOWED_CIDR "$PUBLIC_DB_ALLOWED_CIDR"
echo "Allowed PostgreSQL CIDR changed to $PUBLIC_DB_ALLOWED_CIDR."
