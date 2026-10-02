#!/usr/bin/env bash
# One-shot real Bulk Data test through the fixed-address vendor-egress proxy,
# now that SanMar has approved the address (30 Sep 2026, Khush Singh: "I've
# allowed both of your IPs"). Everything runs in this one script on purpose —
# no pausing partway for a separate command, since that pause is exactly what
# kept dropping the CloudShell session on the previous manual attempt.
#
#   export CONFIG_FILE=config.staging.env
#   bash 27-test-bulk-real.sh
#
# Asks for the SanMar login e-mail once, hidden, then runs straight through.
# Saves the raw response to ~/bulk-real-test.xml and prints the verdict.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state VENDOR_SECRET_ARN
for command_name in aws jq curl; do require_command "$command_name"; done

SHARED_STATE_FILE="$STATE_DIR/gwg-vendor-egress.env"
EGRESS_PUBLIC_IP=""
if [[ -s "$SHARED_STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SHARED_STATE_FILE"
fi
if [[ -z "$EGRESS_PUBLIC_IP" ]]; then
  echo "No EGRESS_PUBLIC_IP in state — run 26-create-vendor-egress.sh first." >&2
  exit 1
fi

echo "Fixed address: $EGRESS_PUBLIC_IP  (this is what SanMar approved)"

VENDOR_JSON="$(aws secretsmanager get-secret-value --secret-id "$VENDOR_SECRET_ARN" --query SecretString --output text)"
PROXY_USER="$(jq -r .SANMAR_VENDOR_PROXY_USERNAME <<< "$VENDOR_JSON")"
PROXY_PASS="$(jq -r .SANMAR_VENDOR_PROXY_PASSWORD <<< "$VENDOR_JSON")"
if [[ -z "$PROXY_USER" || "$PROXY_USER" == "null" ]]; then
  echo "No proxy credential on $VENDOR_SECRET_ARN — run 26-create-vendor-egress.sh first." >&2
  exit 1
fi

read -r -s -p "SanMar login e-mail: " SM_EMAIL; echo
if [[ -z "$SM_EMAIL" ]]; then
  echo "No e-mail entered." >&2
  exit 2
fi

xml_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' <<< "$1"; }
PW_ESC="$(xml_escape "$SM_EMAIL")"

SOAP="<?xml version=\"1.0\" encoding=\"utf-8\"?>
<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">
  <soap:Body>
    <GetBulkDataRequest xmlns=\"https://edi.atc-apparel.com/bulk-data/\">
      <wsVersion>1.0.0</wsVersion>
      <id>161</id>
      <password>${PW_ESC}</password>
    </GetBulkDataRequest>
  </soap:Body>
</soap:Envelope>"

OUT="$HOME/bulk-real-test.xml"
echo "Calling Bulk Data for account 161 through $EGRESS_PUBLIC_IP ..."
HTTP_CODE="$(curl -sS -m 90 -o "$OUT" -w '%{http_code}' \
  -x "http://${PROXY_USER}:${PROXY_PASS}@${EGRESS_PUBLIC_IP}:8888" \
  -X POST "https://edi.atc-apparel.com/bulk-data/BulkDataService.php" \
  -H "Content-Type: text/xml; charset=utf-8" -H "SOAPAction: getBulkData" \
  --data "$SOAP")"
unset SM_EMAIL PW_ESC SOAP

echo "HTTP status: $HTTP_CODE"
echo "Saved to: $OUT"
echo
echo "Codes / descriptions found:"
# A real answer carries one <description> per product part (tens of
# thousands), and the reply's own status message is always the last of them,
# so only that one is shown. A rejection has just the one.
grep -o '<[a-zA-Z0-9:]*code>[^<]*' "$OUT" | tail -1 | sed 's/^/  /' || true
grep -o '<[a-zA-Z0-9:]*description>[^<]*' "$OUT" | tail -1 | sed 's/^/  /' || true

# A REJECTED response still contains one empty placeholder <Product> block
# with every field self-closed (<productId/>), so merely counting <Product>
# tags previously misreported that placeholder as a real row. A genuine
# result has actual text inside <productId>...</productId> — check that,
# and check the known failure phrases FIRST so this can never again print
# "SUCCESS" over a real rejection sitting right next to it.
# The whole reply is one line, so `grep -c` (which counts lines) could only
# ever say 0 or 1. Count the matches themselves.
REAL_ROWS="$(grep -oE '<[a-zA-Z0-9:]*productId>[^<]+</' "$OUT" | wc -l | tr -d ' ' || true)"
echo
echo "Product rows with real data: ${REAL_ROWS:-0}"
echo
if grep -qi 'not authorized user for this call' "$OUT"; then
  echo ">>> REFUSED (not authorized, code 120). SanMar refuses the login e-mail you typed and/or this address. On 1 Oct 2026 the individual login from SanMar's own working test succeeded through this address and the shop's general inbox did not — try the individual login."
elif grep -qi 'daily.?limit\|already.?called\|maximum.\{0,3\}limit' "$OUT"; then
  echo ">>> Daily limit already used today — that itself only happens on a working call for this login. Try again tomorrow."
elif [[ "${REAL_ROWS:-0}" != "0" ]]; then
  echo ">>> SUCCESS. Bulk Data is working for account 161 through the fixed address."
else
  echo ">>> Unrecognized response — read $OUT directly."
fi
