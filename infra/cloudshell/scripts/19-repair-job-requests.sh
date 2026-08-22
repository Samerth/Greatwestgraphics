#!/usr/bin/env bash
# Add every job_requests column the staff inbox can SELECT, then print the
# live column list so we can see whether migrate actually changed staging.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state DB_SG_ID DB_SECRET_ARN RDS_ENDPOINT CURRENT_ALLOWED_CIDR
for command_name in aws jq docker curl; do require_command "$command_name"; done

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
  unset TARGET_DATABASE_URL
  if [[ "$TEMP_RULE_ADDED" == "true" ]]; then
    aws ec2 revoke-security-group-ingress --group-id "$DB_SG_ID" --protocol tcp \
      --port 5432 --cidr "$CLOUDSHELL_CIDR" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$CLOUDSHELL_CIDR" != "$CURRENT_ALLOWED_CIDR" ]]; then
  authorize_postgres_cidr "$DB_SG_ID" "$CLOUDSHELL_CIDR" "Temporary CloudShell job-requests repair"
  TEMP_RULE_ADDED=true
fi

docker pull postgres:16-alpine >/dev/null

psql_query() {
  docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine \
    sh -c "psql \"\$TARGET_DATABASE_URL\" -v ON_ERROR_STOP=1 -Atc \"$1\""
}

echo "--- job_requests columns before ---"
psql_query "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='job_requests' ORDER BY 1;"

echo "--- applying inbox catch-up ---"
psql_query "
DO \$\$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'not_started', 'requires_payment', 'processing', 'succeeded',
    'failed', 'cancelled', 'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END \$\$;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS display_id text;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'not_started';
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS stripe_checkout_session_id uuid;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS final_quote_amount_minor bigint;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS cod_crm_job_id text;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS last_crm_sync_at timestamp with time zone;
WITH numbered AS (
  SELECT id, 'GWG-' || lpad((1000 + row_number() OVER (PARTITION BY tenant_id ORDER BY created_at ASC, id ASC))::text, 4, '0') AS display_id
  FROM job_requests WHERE display_id IS NULL
)
UPDATE job_requests AS j SET display_id = numbered.display_id FROM numbered WHERE j.id = numbered.id;
CREATE TABLE IF NOT EXISTS payment_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  account_id uuid NOT NULL,
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  final_quote_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  external_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);
"

echo "--- job_requests columns after ---"
psql_query "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='job_requests' ORDER BY 1;"

echo "--- inbox probe (must not error) ---"
psql_query "SELECT id, display_id, status, last_crm_sync_at FROM job_requests LIMIT 3;"
echo "job_requests rows: $(psql_query "SELECT count(*) FROM job_requests;")"
echo "payment_obligations exists: $(psql_query "SELECT to_regclass('public.payment_obligations');")"

echo "Repair finished. Reload Admin → Jobs. Do not db:seed."
