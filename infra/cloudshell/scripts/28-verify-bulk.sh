#!/usr/bin/env bash
# Read-only check of a REAL Bulk Data reply (saved by 27-test-bulk-real.sh as
# ~/bulk-real-test.xml) against the SanMar rows already in the staging database.
# It writes nothing to the database and never calls SanMar, so it does not use
# up the day's one Bulk call.
#
# It answers the two questions nobody could answer before today, because Bulk
# had never returned real data:
#
#   1. JOIN: does a Bulk part id ("17977-1") match the key the catalogue stores
#      for the same garment (ss_variants.external_key)? If it does not, the
#      Bulk refresh would "succeed" and update nothing, silently.
#   2. PRICE: is Bulk's `price` the same kind of number as the price the
#      catalogue holds today (from the per-style Pricing service)? If Bulk is
#      systematically different, switching to Bulk changes what customers pay.
#
#   export CONFIG_FILE=config.staging.env
#   bash 28-verify-bulk.sh                      # uses ~/bulk-real-test.xml
#   bash 28-verify-bulk.sh /path/to/reply.xml   # or name the file
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

BULK_FILE="${1:-$HOME/bulk-real-test.xml}"
[[ -s "$BULK_FILE" ]] || {
  echo "No Bulk reply at $BULK_FILE - run 27-test-bulk-real.sh first, or pass the file path." >&2
  exit 1
}

require_state DB_SG_ID DB_SECRET_ARN RDS_ENDPOINT CURRENT_ALLOWED_CIDR
for command_name in aws jq docker curl python3; do require_command "$command_name"; done

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
  rm -rf "$WORK_DIR"
  if [[ "$TEMP_RULE_ADDED" == "true" ]]; then
    aws ec2 revoke-security-group-ingress --group-id "$DB_SG_ID" --protocol tcp \
      --port 5432 --cidr "$CLOUDSHELL_CIDR" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$CLOUDSHELL_CIDR" != "$CURRENT_ALLOWED_CIDR" ]]; then
  authorize_postgres_cidr "$DB_SG_ID" "$CLOUDSHELL_CIDR" "Temporary CloudShell Bulk verification"
  TEMP_RULE_ADDED=true
fi

echo "Reading SanMar variants from the database (read-only)..."
docker pull postgres:16-alpine >/dev/null
docker run --rm --env TARGET_DATABASE_URL postgres:16-alpine sh -c \
  "psql \"\$TARGET_DATABASE_URL\" -v ON_ERROR_STOP=1 -c \"COPY (SELECT tenant_id, external_key, sku, customer_price_minor, qty FROM ss_variants WHERE vendor='sanmar') TO STDOUT WITH CSV HEADER\"" \
  > "$WORK_DIR/db-variants.csv"

python3 - "$BULK_FILE" "$WORK_DIR/db-variants.csv" <<'PY'
import csv, re, statistics, sys
from collections import Counter

bulk_path, db_path = sys.argv[1:3]

# ---- Bulk reply: one <Product> per part ----------------------------------
xml = open(bulk_path, encoding="utf-8", errors="replace").read()
def field(block, name):
    m = re.search(r"<(?:[\w.-]+:)?%s>([^<]*)<" % name, block)
    return m.group(1).strip() if m else ""
bulk = {}
for m in re.finditer(r"<(?:[\w.-]+:)?Product>(.*?)</(?:[\w.-]+:)?Product>", xml, re.S):
    b = m.group(1)
    part = field(b, "productId")
    if not part:
        continue
    def num(name):
        t = field(b, name)
        try:
            return float(t)
        except ValueError:
            return None
    bulk[part] = {
        "style": field(b, "style"), "color": field(b, "swatchColor"),
        "size": field(b, "size"), "price": num("price"), "sale": num("salePrice"),
        "qty": int(float(field(b, "quantity") or 0)),
    }
del xml

# ---- Database: what the catalogue holds today ----------------------------
db = {}
tenants = Counter()
no_key = 0
with open(db_path, newline="", encoding="utf-8") as fh:
    for row in csv.DictReader(fh):
        tenants[row["tenant_id"]] += 1
        key = row["external_key"].strip()
        if not key:
            no_key += 1
            continue
        db[key] = {"price_minor": int(row["customer_price_minor"] or 0), "qty": int(row["qty"] or 0), "sku": row["sku"]}

print()
print("=" * 64)
print("1. JOIN  (Bulk part id  vs  ss_variants.external_key)")
print("=" * 64)
print(f"Bulk parts in the reply          : {len(bulk):>7}")
print(f"SanMar variants in the database  : {sum(tenants.values()):>7}  (tenants: {len(tenants)})")
if no_key:
    print(f"  ...of which have NO external key: {no_key}  (Bulk cannot update these)")
matched = [k for k in db if k in bulk]
db_only = [k for k in db if k not in bulk]
bulk_only = [k for k in bulk if k not in db]
pct_db = 100 * len(matched) / len(db) if db else 0
pct_bulk = 100 * len(matched) / len(bulk) if bulk else 0
print(f"Matched                          : {len(matched):>7}  ({pct_db:.1f}% of database variants, {pct_bulk:.1f}% of Bulk parts)")
print(f"In database, missing from Bulk   : {len(db_only):>7}")
print(f"In Bulk, not in database         : {len(bulk_only):>7}  (skipped by the refresh; a full sync adds them)")
print("Key format - database :", ", ".join(sorted(db)[:4]) or "(none)")
print("Key format - Bulk     :", ", ".join(sorted(bulk)[:4]) or "(none)")
if db_only:
    print("Examples in database only:", ", ".join(db_only[:6]))
if bulk_only:
    print("Examples in Bulk only    :", ", ".join(bulk_only[:6]))
if len(db) and pct_db < 90:
    print(">>> LOW MATCH: the Bulk refresh would leave most variants untouched. Do not rely on it until this is understood.")
elif len(db):
    print(">>> JOIN OK: the Bulk refresh reaches the variants the catalogue holds.")

print()
print("=" * 64)
print("2. PRICE  (Bulk `price`  vs  customer price in the database)")
print("=" * 64)
same = higher = lower = zero = 0
ratios, diffs = [], []
sale_present = sale_equals_db = list_equals_db = 0
for k in matched:
    bp, d = bulk[k]["price"], db[k]["price_minor"] / 100.0
    if bp is None:
        continue
    if bp == 0:
        zero += 1
        continue
    if abs(bp - d) < 0.005:
        same += 1
    elif bp > d:
        higher += 1
    else:
        lower += 1
    if d > 0:
        ratios.append(bp / d)
    if abs(bp - d) >= 0.005:
        diffs.append((abs(bp - d), k, d, bp, bulk[k]["sale"]))
    sp = bulk[k]["sale"]
    if sp:
        sale_present += 1
        if abs(sp - d) < 0.005:
            sale_equals_db += 1
        if abs(bp - d) < 0.005:
            list_equals_db += 1
compared = same + higher + lower
print(f"Matched parts compared           : {compared:>7}")
print(f"  Bulk price equals database     : {same:>7}")
print(f"  Bulk price HIGHER than database: {higher:>7}")
print(f"  Bulk price LOWER than database : {lower:>7}")
print(f"  Bulk price is 0.00 (skipped)   : {zero:>7}")
if ratios:
    print(f"Median Bulk/database price ratio : {statistics.median(ratios):.3f}")
if diffs:
    diffs.sort(reverse=True)
    print("Largest differences (part, database $, Bulk $, Bulk sale $):")
    for _, k, d, bp, sp in diffs[:6]:
        print(f"  {k:<12} {d:>9.2f} {bp:>9.2f}   {('%.2f' % sp) if sp else '-'}")
print()
print(f"Parts on sale in Bulk (matched)  : {sale_present:>7}")
if sale_present:
    print(f"  database price = Bulk SALE price: {sale_equals_db}")
    print(f"  database price = Bulk LIST price: {list_equals_db}")
if compared:
    share = 100 * same / compared
    if share >= 95:
        print(f">>> PRICE OK: {share:.1f}% of matched parts already agree with Bulk's `price`.")
    else:
        print(f">>> PRICE DIFFERS: only {share:.1f}% agree. Read the examples above before letting Bulk write prices.")

print()
print("=" * 64)
print("3. Stock note")
print("=" * 64)
zero_stock_bulk = sum(1 for k in matched if bulk[k]["qty"] == 0)
print(f"Matched parts with 0 stock in Bulk: {zero_stock_bulk} of {len(matched)} (Bulk stock is 'not real-time' per SanMar's guide)")
PY

echo
echo "Done. Nothing was written to the database."
