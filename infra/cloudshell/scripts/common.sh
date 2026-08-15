#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BUNDLE_DIR/../.." && pwd)"
CONFIG_FILE="$BUNDLE_DIR/config.env"
STATE_DIR="$BUNDLE_DIR/.gwg-rds-state"

[[ -f "$CONFIG_FILE" ]] || { echo "Missing $CONFIG_FILE" >&2; exit 1; }

# Parse KEY=VALUE lines without executing the file as bash. Angle brackets in
# CONTACT_FROM_EMAIL would otherwise be treated as redirects.
load_config_file() {
  local file="$1" line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [[ "$value" == \"*\" ]]; then
      value="${value#\"}"
      value="${value%\"}"
    elif [[ "$value" == \'*\' ]]; then
      value="${value#\'}"
      value="${value%\'}"
    fi
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$file"
}

load_config_file "$CONFIG_FILE"

export AWS_REGION AWS_PAGER=""
NAME_PREFIX="${PROJECT}-${ENVIRONMENT}"

# State is per environment. A single shared file was safe while only one
# environment existed, but a second one would read the first's VPC, database and
# load balancer IDs out of it and adopt those resources instead of creating its
# own.
STATE_FILE="$STATE_DIR/$NAME_PREFIX.env"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

# Move the old shared file under the name of the environment that wrote it. The
# match on NAME_PREFIX is what makes this safe: running as a new environment
# leaves the old file untouched rather than inheriting another stack.
LEGACY_STATE_FILE="$STATE_DIR/outputs.env"
if [[ -f "$LEGACY_STATE_FILE" && ! -f "$STATE_FILE" ]]; then
  if grep -q "$NAME_PREFIX" "$LEGACY_STATE_FILE" 2>/dev/null; then
    mv "$LEGACY_STATE_FILE" "$STATE_FILE"
    echo "Moved existing state to $(basename "$STATE_FILE")" >&2
  else
    echo "Note: $LEGACY_STATE_FILE belongs to another environment; starting $NAME_PREFIX empty." >&2
  fi
fi

touch "$STATE_FILE"
chmod 600 "$STATE_FILE"

if [[ -s "$STATE_FILE" ]]; then
  # This file contains resource identifiers and CIDRs, but no credentials.
  # shellcheck disable=SC1090
  source "$STATE_FILE"
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

# Bash rejects ${!name:-}. Use -v + ${!name} instead.
get_state() {
  local name="$1"
  if [[ -v "$name" ]]; then
    printf '%s' "${!name}"
  fi
}

require_state() {
  local key
  for key in "$@"; do
    if ! [[ -v "$key" ]] || [[ -z "$(get_state "$key")" ]]; then
      echo "Missing $key. Run the earlier CloudShell steps first." >&2
      exit 1
    fi
  done
}

save_state() {
  local key="$1" value="$2" tmp
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || {
    echo "Invalid state key: $key" >&2
    exit 1
  }
  tmp="$(mktemp)"
  awk -F= -v key="$key" '$1 != key' "$STATE_FILE" > "$tmp"
  printf '%s=%q\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$STATE_FILE"
  # shellcheck disable=SC1090
  source "$STATE_FILE"
}

urlencode() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

authorize_postgres_cidr() {
  local group_id="$1" cidr="$2" description="$3" permissions err
  permissions="$(jq -nc --arg cidr "$cidr" --arg description "$description" \
    '[{IpProtocol:"tcp",FromPort:5432,ToPort:5432,IpRanges:[{CidrIp:$cidr,Description:$description}]}]')"
  err="$(mktemp)"
  if aws ec2 authorize-security-group-ingress --group-id "$group_id" \
    --ip-permissions "$permissions" >/dev/null 2>"$err"; then
    rm -f "$err"
    return 0
  fi
  if grep -q InvalidPermission.Duplicate "$err"; then
    rm -f "$err"
    return 0
  fi
  cat "$err" >&2
  rm -f "$err"
  return 1
}

authorize_sg_ingress() {
  local group_id="$1" protocol="$2" from_port="$3" to_port="$4"
  local source_kind="$5" source_value="$6" description="$7"
  local permissions err
  if [[ "$source_kind" == "cidr" ]]; then
    permissions="$(jq -nc --arg proto "$protocol" --argjson from "$from_port" --argjson to "$to_port" \
      --arg cidr "$source_value" --arg description "$description" \
      '[{IpProtocol:$proto,FromPort:$from,ToPort:$to,IpRanges:[{CidrIp:$cidr,Description:$description}]}]')"
  else
    permissions="$(jq -nc --arg proto "$protocol" --argjson from "$from_port" --argjson to "$to_port" \
      --arg sg "$source_value" --arg description "$description" \
      '[{IpProtocol:$proto,FromPort:$from,ToPort:$to,UserIdGroupPairs:[{GroupId:$sg,Description:$description}]}]')"
  fi
  err="$(mktemp)"
  if aws ec2 authorize-security-group-ingress --group-id "$group_id" \
    --ip-permissions "$permissions" >/dev/null 2>"$err"; then
    rm -f "$err"
    return 0
  fi
  if grep -q InvalidPermission.Duplicate "$err"; then
    rm -f "$err"
    return 0
  fi
  cat "$err" >&2
  rm -f "$err"
  return 1
}

rds_database_url() {
  require_state DB_SECRET_ARN RDS_ENDPOINT DB_NAME DB_USERNAME
  local secret password encoded
  secret="$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ARN" \
    --query SecretString --output text)"
  password="$(jq -r .password <<< "$secret")"
  encoded="$(urlencode "$password")"
  printf 'postgresql://%s:%s@%s:5432/%s?sslmode=require' \
    "$DB_USERNAME" "$encoded" "$RDS_ENDPOINT" "$DB_NAME"
}
