#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

# Copy catalogue and pricing data from one environment's database into another,
# so a non-production stack prices and browses like the real site.
#
# Customer records are left behind by default. Names, emails, addresses,
# uploaded artwork and payment rows are the kind of data that should not be
# duplicated into an environment with weaker access controls just to make a test
# site look populated.

usage() {
  cat >&2 <<'EOF'
Usage: 15-copy-database.sh --from <environment> --to <environment> [options]

  --from ENV               environment to read from, e.g. prod
  --to ENV                 environment to write to, e.g. staging
  --include-customer-data  also copy people, orders, quotes, payments and artwork
  --yes                    skip the confirmation prompt

The target is emptied of the tables being copied. The source is only read.
EOF
  exit 1
}

SOURCE_ENV="" TARGET_ENV="" INCLUDE_CUSTOMER_DATA=false ASSUME_YES=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) SOURCE_ENV="${2:-}"; shift 2 ;;
    --to) TARGET_ENV="${2:-}"; shift 2 ;;
    --include-customer-data) INCLUDE_CUSTOMER_DATA=true; shift ;;
    --yes) ASSUME_YES=true; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done
[[ -n "$SOURCE_ENV" && -n "$TARGET_ENV" ]] || usage
[[ "$SOURCE_ENV" != "$TARGET_ENV" ]] || {
  echo "Source and target are the same environment." >&2
  exit 1
}

# The whole risk of this script is the arguments arriving the wrong way round.
# Everything else it does is reversible; writing over production is not.
case "$TARGET_ENV" in
  prod|production)
    echo "Refusing to write into '$TARGET_ENV'." >&2
    echo "This script only ever populates non-production environments." >&2
    exit 1
    ;;
esac

for command_name in aws jq docker; do require_command "$command_name"; done

# Read another environment's state file. These are written by the provisioning
# scripts with printf %q, so sourcing is how the values come back intact.
state_var() {
  local environment="$1" name="$2" file="$STATE_DIR/${PROJECT}-${environment}.env"
  [[ -f "$file" ]] || {
    echo "No state file for environment '$environment' (expected $file)." >&2
    echo "Run the provisioning scripts for it first." >&2
    exit 1
  }
  ( set +u; # shellcheck disable=SC1090
    source "$file"; printf '%s' "${!name-}" )
}

database_url_for() {
  local environment="$1" secret_arn endpoint database username secret password encoded
  secret_arn="$(state_var "$environment" DB_SECRET_ARN)"
  endpoint="$(state_var "$environment" RDS_ENDPOINT)"
  database="$(state_var "$environment" DB_NAME)"
  username="$(state_var "$environment" DB_USERNAME)"
  [[ -n "$secret_arn" && -n "$endpoint" && -n "$database" && -n "$username" ]] || {
    echo "Environment '$environment' has no database recorded in its state." >&2
    exit 1
  }
  secret="$(aws secretsmanager get-secret-value --secret-id "$secret_arn" \
    --query SecretString --output text)"
  password="$(jq -r .password <<< "$secret")"
  encoded="$(urlencode "$password")"
  printf 'postgresql://%s:%s@%s:5432/%s?sslmode=require' \
    "$username" "$encoded" "$endpoint" "$database"
}

CATALOGUE_TABLES=(
  tenants stores
  vendors vendor_mappings vendor_field_mappings normalization_rules
  categories category_overrides catalog_settings store_category_visibility
  products product_variants product_styles product_media product_3d_models
  pricing_configs
  ss_products ss_variants ss_styles
  ss_product_categories ss_category_map ss_unmapped_categories
)
CUSTOMER_TABLES=(
  people accounts account_people account_invites external_identities
  job_requests job_request_lines job_request_snapshots job_request_status_history
  final_quotes invoices refunds
  payment_intents payment_obligations payment_sessions stripe_checkout_sessions
  design_projects artwork_versions proof_versions media_assets inbox_messages
  crm_order_syncs crm_status_updates
)

WANTED=("${CATALOGUE_TABLES[@]}")
if [[ "$INCLUDE_CUSTOMER_DATA" == "true" ]]; then
  WANTED+=("${CUSTOMER_TABLES[@]}")
fi

SOURCE_DATABASE_URL="$(database_url_for "$SOURCE_ENV")"
TARGET_DATABASE_URL="$(database_url_for "$TARGET_ENV")"
export SOURCE_DATABASE_URL TARGET_DATABASE_URL

SOURCE_SG="$(state_var "$SOURCE_ENV" DB_SG_ID)"
TARGET_SG="$(state_var "$TARGET_ENV" DB_SG_ID)"
HERE_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '\r\n')"
[[ "$HERE_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || {
  echo "Could not determine this host's public IPv4 address." >&2
  exit 1
}
HERE_CIDR="$HERE_IP/32"
WORK_DIR="$(mktemp -d)"
GRANTED_SGS=()

cleanup() {
  unset SOURCE_DATABASE_URL TARGET_DATABASE_URL
  local group
  for group in "${GRANTED_SGS[@]:-}"; do
    [[ -n "$group" ]] || continue
    aws ec2 revoke-security-group-ingress --group-id "$group" --protocol tcp \
      --port 5432 --cidr "$HERE_CIDR" >/dev/null 2>&1 || true
  done
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

grant_access() {
  local group="$1"
  [[ -n "$group" ]] || return 0
  if authorize_postgres_cidr "$group" "$HERE_CIDR" "Temporary database copy access"; then
    GRANTED_SGS+=("$group")
  fi
}
grant_access "$SOURCE_SG"
[[ "$TARGET_SG" == "$SOURCE_SG" ]] || grant_access "$TARGET_SG"

docker pull postgres:16-alpine >/dev/null

psql_source() { docker run --rm --env SOURCE_DATABASE_URL postgres:16-alpine \
  sh -c "psql \"\$SOURCE_DATABASE_URL\" -v ON_ERROR_STOP=1 -Atc \"$1\""; }
psql_target() { docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine \
  sh -c "psql \"\$TARGET_DATABASE_URL\" -v ON_ERROR_STOP=1 -Atc \"$1\""; }

# Only touch tables that exist on both sides. The two environments can be at
# different migration revisions, and a missing table should narrow the copy
# rather than abort it.
list_tables() {
  local which="$1"
  "psql_$which" "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY 1;"
}
mapfile -t SOURCE_TABLES < <(list_tables source)
mapfile -t TARGET_TABLES < <(list_tables target)

in_list() { local needle="$1"; shift; local item; for item in "$@"; do [[ "$item" == "$needle" ]] && return 0; done; return 1; }

COPY=() SKIPPED=()
for table in "${WANTED[@]}"; do
  if in_list "$table" "${SOURCE_TABLES[@]}" && in_list "$table" "${TARGET_TABLES[@]}"; then
    COPY+=("$table")
  else
    SKIPPED+=("$table")
  fi
done
[[ ${#COPY[@]} -gt 0 ]] || { echo "Nothing to copy: no requested table exists on both sides." >&2; exit 1; }

echo
echo "From: $SOURCE_ENV  $(state_var "$SOURCE_ENV" RDS_ENDPOINT)"
echo "To:   $TARGET_ENV  $(state_var "$TARGET_ENV" RDS_ENDPOINT)"
echo
echo "Copying ${#COPY[@]} tables:"
printf '  %s\n' "${COPY[@]}" | paste -sd' ' - | fold -w 76 -s | sed 's/^/  /'
if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  echo
  echo "Not present on both sides, skipping: ${SKIPPED[*]}"
fi
if [[ "$INCLUDE_CUSTOMER_DATA" == "true" ]]; then
  echo
  echo "WARNING: customer data is included. Real names, email addresses, orders,"
  echo "artwork and payment records will be duplicated into $TARGET_ENV."
else
  echo
  echo "Customer, order, quote, payment and artwork tables are NOT copied."
fi
echo
echo "Rows in these tables in $TARGET_ENV will be deleted first."

if [[ "$ASSUME_YES" != "true" ]]; then
  read -rp "Type '$TARGET_ENV' to continue: " CONFIRM
  [[ "$CONFIRM" == "$TARGET_ENV" ]] || { echo "Cancelled."; exit 1; }
fi

DUMP_ARGS=()
for table in "${COPY[@]}"; do DUMP_ARGS+=(--table="public.$table"); done

echo
echo "Exporting from $SOURCE_ENV..."
# The connection string stays in the environment rather than the argument list,
# so the password never appears in the host's process table.
docker run --rm --env SOURCE_DATABASE_URL -v "$WORK_DIR:/work" postgres:16-alpine \
  sh -c 'exec pg_dump "$SOURCE_DATABASE_URL" --data-only --no-owner --no-acl \
    --format=plain --file=/work/data.sql "$@"' -- "${DUMP_ARGS[@]}"

# One transaction, foreign keys deferred. pg_dump writes table data in
# alphabetical order rather than dependency order, so a plain data load would
# otherwise fail on references between the catalogue tables.
{
  echo "BEGIN;"
  echo "SET session_replication_role = replica;"
  printf 'TRUNCATE TABLE %s RESTART IDENTITY CASCADE;\n' \
    "$(printf 'public.%s,' "${COPY[@]}" | sed 's/,$//')"
  cat "$WORK_DIR/data.sql"
  echo "COMMIT;"
} > "$WORK_DIR/load.sql"

echo "Loading into $TARGET_ENV..."
docker run --rm --env TARGET_DATABASE_URL -v "$WORK_DIR:/work:ro" postgres:16-alpine \
  sh -c 'psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f /work/load.sql' >/dev/null

echo
echo "Row counts after the copy:"
FAILED=false
for table in "${COPY[@]}"; do
  source_rows="$(psql_source "SELECT count(*) FROM public.$table;")"
  target_rows="$(psql_target "SELECT count(*) FROM public.$table;")"
  if [[ "$source_rows" == "$target_rows" ]]; then
    printf '  %-28s %s\n' "$table" "$source_rows"
  else
    printf '  %-28s source=%s target=%s  MISMATCH\n' "$table" "$source_rows" "$target_rows"
    FAILED=true
  fi
done

[[ "$FAILED" == "false" ]] || {
  echo >&2
  echo "At least one table did not match. The load ran in a single transaction," >&2
  echo "so a mismatch means the source changed mid-copy rather than a partial load." >&2
  exit 1
}

# Deliberately no save_state here: this script is invoked with whichever config
# happens to be loaded, so the ambient state file is not reliably the target's.
echo
echo "Done. $SOURCE_ENV was only read from."
echo "Temporary database access for $HERE_CIDR is being removed."
