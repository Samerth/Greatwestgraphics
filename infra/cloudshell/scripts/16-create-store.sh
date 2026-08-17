#!/usr/bin/env bash
# Give the environment a store to serve, and record which one it is.
#
# The storefront needs a tenant, an account and a store row before it can show
# anything, and it needs to be told which of them it is serving. Nothing in the
# earlier scripts created those rows: 02-migrate-drizzle.sh builds the schema and
# leaves every table empty, and `npm run db:seed` is explicitly not for a real
# environment. The gap was invisible because the storefront never fails on it --
# it falls back to a marketing shell with an empty tenant id and serves a
# perfectly healthy-looking page with no catalogue behind it.
#
# So this script creates the rows if they are missing, adopts them if they are
# already there, registers the site's hostname on the store, and writes the three
# ids into the environment's state file. 09-create-ecs.sh reads state, so the
# next run of it puts COMMERCE_DEFAULT_* on the web task without anyone having to
# remember the values.
#
# Safe to run repeatedly, and safe to run before the final hostname is known --
# it registers the hostname only once SITE_URL exists, and the ids do not depend
# on it.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state DB_SG_ID DB_SECRET_ARN RDS_ENDPOINT
for command_name in aws jq docker curl python3; do require_command "$command_name"; done

STORE_NAME="${COMMERCE_DEFAULT_STORE_NAME:-Great West Graphics}"
STORE_SLUG="${COMMERCE_DEFAULT_STORE_SLUG:-great-west-graphics}"
TENANT_NAME="${STORE_NAME}"
ACCOUNT_NAME="${STORE_NAME}"

# The hostname a browser actually reaches the storefront on. SITE_URL is written
# by 09-create-ecs.sh and already accounts for SITE_HOSTNAME, so deriving the
# host from it keeps this script agreeing with the web task's own idea of where
# it lives instead of guessing a second time.
STORE_HOST=""
if [[ -n "${SITE_URL:-}" ]]; then
  STORE_HOST="${SITE_URL#*://}"
  STORE_HOST="${STORE_HOST%%/*}"
  STORE_HOST="${STORE_HOST%%:*}"
  STORE_HOST="$(printf '%s' "$STORE_HOST" | tr '[:upper:]' '[:lower:]')"
fi

TARGET_DATABASE_URL="$(rds_database_url)"
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
  unset TARGET_DATABASE_URL
  rm -rf "$WORK_DIR" >/dev/null 2>&1 || true
  if [[ "$TEMP_RULE_ADDED" == "true" ]]; then
    aws ec2 revoke-security-group-ingress --group-id "$DB_SG_ID" --protocol tcp \
      --port 5432 --cidr "$CLOUDSHELL_CIDR" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$CLOUDSHELL_CIDR" != "${CURRENT_ALLOWED_CIDR:-}" ]]; then
  authorize_postgres_cidr "$DB_SG_ID" "$CLOUDSHELL_CIDR" "Temporary CloudShell store setup"
  TEMP_RULE_ADDED=true
fi

docker pull postgres:16-alpine >/dev/null

# The connection string stays in the environment rather than the argument list,
# so the password never appears in the host's process table.
psql_query() { docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine \
  sh -c "psql \"\$TARGET_DATABASE_URL\" -v ON_ERROR_STOP=1 -Atc \"$1\""; }

sql_literal() { printf "'%s'" "${1//\'/\'\'}"; }
new_uuid() { python3 -c 'import uuid; print(uuid.uuid4())'; }

# Which store this environment serves, in order of how much we can trust it: the
# one already recorded in state, then the only one in the database, and finally a
# new one. Adopting the single existing row matters -- an environment that was
# seeded by hand has a store already, and creating a second one would leave two
# plausible answers to "which store is this site".
STORE_ID="" TENANT_ID="" ACCOUNT_ID=""
if [[ -n "${COMMERCE_DEFAULT_STORE_ID:-}" ]]; then
  ROW="$(psql_query "SELECT id||' '||tenant_id||' '||account_id||' '||slug||' '||name FROM stores WHERE id = $(sql_literal "$COMMERCE_DEFAULT_STORE_ID");")"
  [[ -n "$ROW" ]] || {
    echo "State names store $COMMERCE_DEFAULT_STORE_ID but no such row exists." >&2
    echo "Remove COMMERCE_DEFAULT_STORE_ID from the state file to create a new one." >&2
    exit 1
  }
fi
if [[ -z "${ROW:-}" ]]; then
  COUNT="$(psql_query "SELECT count(*) FROM stores;")"
  if [[ "$COUNT" -gt 1 ]]; then
    echo "This database holds $COUNT stores and state names none of them." >&2
    echo "Set COMMERCE_DEFAULT_TENANT_ID / _ACCOUNT_ID / _STORE_ID in the config" >&2
    echo "for the one this environment serves, then run this script again." >&2
    exit 1
  fi
  if [[ "$COUNT" == "1" ]]; then
    ROW="$(psql_query "SELECT id||' '||tenant_id||' '||account_id||' '||slug||' '||name FROM stores;")"
    echo "Adopting the store already in this database."
  fi
fi

if [[ -n "${ROW:-}" ]]; then
  # Its own name and slug win over the configured ones. The pinned identity has
  # to describe the row that exists, not the row we would have created.
  read -r STORE_ID TENANT_ID ACCOUNT_ID STORE_SLUG STORE_NAME <<<"$ROW"
else
  TENANT_ID="$(new_uuid)"
  ACCOUNT_ID="$(new_uuid)"
  STORE_ID="$(new_uuid)"
  echo "Creating tenant, account and store for $NAME_PREFIX."
  {
    echo "BEGIN;"
    printf 'INSERT INTO tenants (id, name) VALUES (%s, %s);\n' \
      "$(sql_literal "$TENANT_ID")" "$(sql_literal "$TENANT_NAME")"
    printf 'INSERT INTO accounts (id, tenant_id, name) VALUES (%s, %s, %s);\n' \
      "$(sql_literal "$ACCOUNT_ID")" "$(sql_literal "$TENANT_ID")" "$(sql_literal "$ACCOUNT_NAME")"
    printf 'INSERT INTO stores (id, tenant_id, account_id, name, slug) VALUES (%s, %s, %s, %s, %s);\n' \
      "$(sql_literal "$STORE_ID")" "$(sql_literal "$TENANT_ID")" "$(sql_literal "$ACCOUNT_ID")" \
      "$(sql_literal "$STORE_NAME")" "$(sql_literal "$STORE_SLUG")"
    echo "COMMIT;"
  } > "$WORK_DIR/create.sql"
  docker run --rm --env TARGET_DATABASE_URL -v "$WORK_DIR:/work:ro" postgres:16-alpine \
    sh -c 'psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f /work/create.sql' >/dev/null
fi

# custom_domain is unique across the whole table, so a host held by a different
# store is a collision that has to be resolved by a person: silently moving it
# would repoint another environment's site at this one's store.
if [[ -n "$STORE_HOST" ]]; then
  CLASH="$(psql_query "SELECT id FROM stores WHERE custom_domain = $(sql_literal "$STORE_HOST") AND id <> $(sql_literal "$STORE_ID");")"
  if [[ -n "$CLASH" ]]; then
    echo "Host $STORE_HOST is already registered on store $CLASH." >&2
    echo "Clear it there before registering it here." >&2
    exit 1
  fi
  psql_query "UPDATE stores SET custom_domain = $(sql_literal "$STORE_HOST"), updated_at = now() WHERE id = $(sql_literal "$STORE_ID") AND coalesce(custom_domain, '') <> $(sql_literal "$STORE_HOST");" >/dev/null
  echo "Registered host:  $STORE_HOST"
else
  echo "No SITE_URL in state yet, so no hostname was registered."
  echo "Run this script again after 09-create-ecs.sh (and 14-create-cloudfront.sh)."
fi

save_state COMMERCE_DEFAULT_TENANT_ID "$TENANT_ID"
save_state COMMERCE_DEFAULT_ACCOUNT_ID "$ACCOUNT_ID"
save_state COMMERCE_DEFAULT_STORE_ID "$STORE_ID"
save_state COMMERCE_DEFAULT_STORE_SLUG "$STORE_SLUG"
save_state COMMERCE_DEFAULT_STORE_NAME "$STORE_NAME"

cat <<EOF

Store identity for $NAME_PREFIX:
  tenant   $TENANT_ID
  account  $ACCOUNT_ID
  store    $STORE_ID  ($STORE_SLUG)

These are now in the environment's state file, which 09-create-ecs.sh reads.
Re-run it so the web task carries them:

  ./scripts/09-create-ecs.sh

Until it does, the storefront serves a marketing shell with no catalogue behind
it -- a page that looks fine and sells nothing.
EOF
