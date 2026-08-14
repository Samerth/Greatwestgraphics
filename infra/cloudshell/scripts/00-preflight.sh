#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

for command_name in aws jq python3 curl; do
  require_command "$command_name"
done

[[ "$AWS_REGION" == "ca-central-1" ]] || {
  echo "Refusing unexpected region: $AWS_REGION" >&2
  exit 1
}
[[ "$PUBLIC_DB_ALLOWED_CIDR" != "REPLACE_WITH_TRUSTED_IPV4_CIDR" ]] || {
  echo "Set PUBLIC_DB_ALLOWED_CIDR in config.env before running." >&2
  echo "Use your public IPv4 with /32, for example: curl -fsS https://checkip.amazonaws.com" >&2
  exit 1
}
[[ "$PUBLIC_DB_ALLOWED_CIDR" != "0.0.0.0/0" ]] || {
  echo "Refusing to expose PostgreSQL to 0.0.0.0/0." >&2
  exit 1
}
[[ "$PUBLIC_DB_ALLOWED_CIDR" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]] || {
  echo "PUBLIC_DB_ALLOWED_CIDR must be an IPv4 CIDR such as 203.0.113.10/32." >&2
  exit 1
}
[[ "$DB_NAME" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]] || {
  echo "DB_NAME contains unsupported characters." >&2
  exit 1
}
[[ "$DB_USERNAME" =~ ^[a-zA-Z][a-zA-Z0-9_]*$ ]] || {
  echo "DB_USERNAME contains unsupported characters." >&2
  exit 1
}

aws sts get-caller-identity >/dev/null
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text)"
AZ_COUNT="$(aws ec2 describe-availability-zones --filters Name=state,Values=available \
  --query 'length(AvailabilityZones)' --output text)"
[[ "$AZ_COUNT" -ge 2 ]] || { echo "At least two available AZs are required." >&2; exit 1; }

if command -v docker >/dev/null 2>&1; then
  docker info >/dev/null
else
  echo "Warning: docker is not available. Migration and image-build steps will be skipped until it is."
fi

save_state ACCOUNT_ID "$ACCOUNT_ID"
save_state CALLER_ARN "$CALLER_ARN"

echo "Preflight passed"
echo "Account:       $ACCOUNT_ID"
echo "Caller:        $CALLER_ARN"
echo "Region:        $AWS_REGION"
echo "Allowed CIDR:  $PUBLIC_DB_ALLOWED_CIDR"
echo "No AWS resources were created by this step."
