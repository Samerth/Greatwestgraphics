#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

echo "This step dumps the Supabase public schema into RDS."
echo "Use it only if Great West Graphics application data already lives in Supabase."
echo "For this repo's canonical schema, prefer ./scripts/02-migrate-drizzle.sh instead."
echo

require_state DB_SG_ID DB_SECRET_ARN RDS_ENDPOINT CURRENT_ALLOWED_CIDR
for command_name in aws jq docker curl; do require_command "$command_name"; done

read -rsp "Supabase PostgreSQL connection URL (hidden): " SOURCE_DATABASE_URL
echo
[[ "$SOURCE_DATABASE_URL" == postgresql://* || "$SOURCE_DATABASE_URL" == postgres://* ]] || {
  unset SOURCE_DATABASE_URL
  echo "Expected a PostgreSQL connection URL." >&2
  exit 1
}
export SOURCE_DATABASE_URL

TARGET_DATABASE_URL="$(rds_database_url)"
export TARGET_DATABASE_URL

CLOUDSHELL_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '\r\n')"
[[ "$CLOUDSHELL_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || {
  echo "Could not determine the CloudShell public IPv4 address." >&2
  exit 1
}
CLOUDSHELL_CIDR="$CLOUDSHELL_IP/32"
TEMP_RULE_ADDED=false
BACKUP_DIR="$(mktemp -d)"

cleanup() {
  unset SOURCE_DATABASE_URL TARGET_DATABASE_URL
  if [[ "$TEMP_RULE_ADDED" == "true" ]]; then
    aws ec2 revoke-security-group-ingress --group-id "$DB_SG_ID" --protocol tcp \
      --port 5432 --cidr "$CLOUDSHELL_CIDR" >/dev/null 2>&1 || true
  fi
  rm -f "$BACKUP_DIR/public.dump"
  rmdir "$BACKUP_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ "$CLOUDSHELL_CIDR" != "$CURRENT_ALLOWED_CIDR" ]]; then
  authorize_postgres_cidr "$DB_SG_ID" "$CLOUDSHELL_CIDR" "Temporary CloudShell migration access"
  TEMP_RULE_ADDED=true
fi

docker pull postgres:16-alpine >/dev/null
TARGET_TABLES="$(docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine \
  sh -c 'psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname=\$\$public\$\$;"')"
[[ "$TARGET_TABLES" == "0" ]] || {
  echo "Target contains $TARGET_TABLES non-system tables. Refusing to overwrite it." >&2
  exit 1
}

echo "Testing the Supabase source connection..."
docker run --rm --env SOURCE_DATABASE_URL postgres:16-alpine \
  sh -c 'psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT current_database();"' >/dev/null

echo "Exporting the Supabase public schema and data..."
docker run --rm --env SOURCE_DATABASE_URL -v "$BACKUP_DIR:/backup" postgres:16-alpine \
  sh -c 'pg_dump "$SOURCE_DATABASE_URL" --format=custom --schema=public --no-owner --no-acl \
  --file=/backup/public.dump'

echo "Restoring into AWS RDS over TLS..."
docker run --rm --env TARGET_DATABASE_URL -v "$BACKUP_DIR:/backup:ro" postgres:16-alpine \
  sh -c 'pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --no-acl --clean --if-exists \
  --exit-on-error /backup/public.dump'

SOURCE_TABLES="$(docker run --rm --env SOURCE_DATABASE_URL postgres:16-alpine \
  sh -c 'psql "$SOURCE_DATABASE_URL" -Atc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname=\$\$public\$\$;"')"
RESTORED_TABLES="$(docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine \
  sh -c 'psql "$TARGET_DATABASE_URL" -Atc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname=\$\$public\$\$;"')"
[[ "$SOURCE_TABLES" == "$RESTORED_TABLES" ]] || {
  echo "Table-count verification failed: source=$SOURCE_TABLES target=$RESTORED_TABLES" >&2
  exit 1
}

save_state MIGRATION_COMPLETED true
save_state MIGRATION_SOURCE supabase
save_state MIGRATED_PUBLIC_TABLE_COUNT "$RESTORED_TABLES"
echo "Migration completed: $RESTORED_TABLES public tables copied."
echo "The Supabase source was not modified."
echo "Temporary CloudShell database access will now be removed."
