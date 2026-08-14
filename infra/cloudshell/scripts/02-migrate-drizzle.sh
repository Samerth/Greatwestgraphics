#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state DB_SG_ID DB_SECRET_ARN RDS_ENDPOINT CURRENT_ALLOWED_CIDR
for command_name in aws jq docker curl; do require_command "$command_name"; done

DRIZZLE_DIR="$REPO_ROOT/services/commerce-api/drizzle"
[[ -f "$DRIZZLE_DIR/meta/_journal.json" ]] || {
  echo "Missing $DRIZZLE_DIR/meta/_journal.json. Clone the GWG repo first." >&2
  exit 1
}

TARGET_DATABASE_URL="$(rds_database_url)"
export DATABASE_URL="$TARGET_DATABASE_URL"
export TARGET_DATABASE_URL

CLOUDSHELL_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '\r\n')"
[[ "$CLOUDSHELL_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || {
  echo "Could not determine the CloudShell public IPv4 address." >&2
  exit 1
}
CLOUDSHELL_CIDR="$CLOUDSHELL_IP/32"
TEMP_RULE_ADDED=false
WORK_DIR="$(mktemp -d)"

cleanup() {
  unset DATABASE_URL TARGET_DATABASE_URL
  if [[ -n "${WORK_DIR:-}" && -d "$WORK_DIR" ]]; then
    docker run --rm -v "$WORK_DIR:/work" alpine:3.20 rm -rf /work >/dev/null 2>&1 || true
    rm -rf "$WORK_DIR" >/dev/null 2>&1 || true
  fi
  if [[ "$TEMP_RULE_ADDED" == "true" ]]; then
    aws ec2 revoke-security-group-ingress --group-id "$DB_SG_ID" --protocol tcp \
      --port 5432 --cidr "$CLOUDSHELL_CIDR" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$CLOUDSHELL_CIDR" != "$CURRENT_ALLOWED_CIDR" ]]; then
  authorize_postgres_cidr "$DB_SG_ID" "$CLOUDSHELL_CIDR" "Temporary CloudShell migration access"
  TEMP_RULE_ADDED=true
fi

cp -a "$DRIZZLE_DIR" "$WORK_DIR/drizzle"
printf '{"type":"module"}\n' > "$WORK_DIR/package.json"
cat > "$WORK_DIR/drizzle.config.js" <<'EOF'
export default {
  dialect: "postgresql",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
};
EOF

echo "Applying Drizzle migrations (journal only — this is what npm run db:migrate uses)..."
docker pull node:22-alpine >/dev/null
docker pull alpine:3.20 >/dev/null
# Install npm packages inside the container filesystem so root-owned
# node_modules are not left on the CloudShell host.
docker run --rm \
  --env DATABASE_URL \
  -v "$WORK_DIR/drizzle:/src/drizzle:ro" \
  -v "$WORK_DIR/drizzle.config.js:/src/drizzle.config.js:ro" \
  -v "$WORK_DIR/package.json:/src/package.json:ro" \
  -w /tmp/migrate \
  node:22-alpine \
  sh -c 'cp /src/package.json /src/drizzle.config.js . && cp -a /src/drizzle ./drizzle && npm install --silent --no-save drizzle-kit@0.30.1 drizzle-orm@0.38.2 postgres@3.4.5 && npx drizzle-kit migrate'

TABLE_COUNT="$(docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine \
  sh -c 'psql "$TARGET_DATABASE_URL" -Atc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname=\$\$public\$\$;"')"

save_state MIGRATION_COMPLETED true
save_state MIGRATION_SOURCE drizzle
save_state MIGRATED_PUBLIC_TABLE_COUNT "$TABLE_COUNT"
echo "Drizzle migrations applied. Public tables: $TABLE_COUNT"
echo "Do not run npm run db:seed against production unless you explicitly want fixture data."
