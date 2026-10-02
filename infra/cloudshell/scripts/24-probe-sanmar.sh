#!/usr/bin/env bash
# Answers the SanMar questions left open on 11 September, from an AWS Canada
# IP, without writing anything to any GWG system:
#
#   1. How many styles does SanMar actually list, against the 472 we hold?
#      (getProductSellable — read-only, no daily limit.)
#   2. What EXACTLY happens when we call Bulk Data — the full raw answer,
#      not just a one-line verdict.
#      (getBulkData — one call per day PER ACCOUNT. A call that returns real
#      product rows spends today's call and is saved; a call that fails does
#      NOT spend the daily call, so failing variants can be retried freely.
#      The instant any variant returns real products, the loop stops and
#      nothing further runs against that account for the rest of the day.)
#   3. Is the password we hold the EDI media password?
#      (getMediaContent on one real style from step 1's own list — so it can
#      only fail on the password, never on a made-up style code.)
#
# Run in AWS CloudShell, ca-central-1. ATC's endpoint answers AWS Canada in
# ~0.1s and refuses connections from outside North America, which is why the
# same probe fails from a developer laptop.
#
#   bash 24-probe-sanmar.sh
#
# Credentials are read silently (no echo, not written to shell history) and
# are never printed. Only counts, verdicts, and (for Bulk) the raw SanMar
# response are shown — the response never contains a credential, since
# SanMar's own reply is what we are inspecting, not our request.
#
# 26 Sep 2026: SanMar's EDI team (Khush Singh) tested Bulk Data with our own
# account and it worked on their end, contradicting the "needs a separate
# entitlement" conclusion drawn from the 11 Sep run. This version of the
# script exists to gather the evidence Khush actually asked for — the exact
# request, the exact error, the error code, the timestamp, and the return
# (egress) IP this ran from — instead of a one-line summary that discards
# the real SanMar response.
set -Eeuo pipefail

BASE="${SANMAR_API_BASE_URL:-https://edi.atc-apparel.com}"
PRODUCT_URL="$BASE/pstd/productdata2.0/ProductDataServiceV2.php"
BULK_URL="$BASE/bulk-data/BulkDataService.php"
MEDIA_URL="$BASE/pstd/mediacontent1.1/MediaContentService.php"
NS_PD="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/"
NS_BULK="https://edi.atc-apparel.com/bulk-data/"
NS_MEDIA="http://www.promostandards.org/WSDL/MediaService/1.0.0/"
NS_MEDIA_SO="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/"

# SanMar's own published practice account (ATC_Pstd_IntegrationGuide_2025,
# p.82, "For sandbox use following credentials"). Public test credentials,
# not a GWG secret — safe to keep in this script in plain text.
SANDBOX_ID="sandbox"
SANDBOX_PASSWORD="sandbox123"

# --- credentials, silently -------------------------------------------------
if [[ -z "${SANMAR_ACCOUNT_ID:-}" ]]; then
  read -r -s -p "SanMar account ID: " SANMAR_ACCOUNT_ID; echo
fi
if [[ -z "${SANMAR_LOGIN_EMAIL:-}" ]]; then
  read -r -s -p "SanMar login e-mail: " SANMAR_LOGIN_EMAIL; echo
fi
if [[ -z "$SANMAR_ACCOUNT_ID" || -z "$SANMAR_LOGIN_EMAIL" ]]; then
  echo "Both values are required." >&2; exit 2
fi
# Optional. The Media service authenticates with a separate password issued
# by SanMar's EDI team — not the login e-mail, not the website password. Press
# Enter to skip if you do not have one; steps 1 and 2 run regardless.
if [[ -z "${SANMAR_MEDIA_PASSWORD:-}" ]]; then
  read -r -s -p "SanMar media password (Enter to skip): " SANMAR_MEDIA_PASSWORD; echo
fi

xml_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' <<< "$1"; }
ID="$(xml_escape "$SANMAR_ACCOUNT_ID")"
PW="$(xml_escape "$SANMAR_LOGIN_EMAIL")"
MPW="$(xml_escape "${SANMAR_MEDIA_PASSWORD:-}")"

soap() {
  local url="$1" action="$2" body="$3"
  curl -sS --max-time 180 -X POST "$url" \
    -H "Content-Type: text/xml; charset=utf-8" \
    -H "SOAPAction: $action" \
    --data-binary @- <<EOF
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    $body
  </soap:Body>
</soap:Envelope>
EOF
}

first_tag() { grep -o "<[a-zA-Z0-9._-]*:\?$2>[^<]*</" <<< "$1" | head -1 | sed -E 's/^<[^>]*>//; s/<\/$//' || true; }

auth_failed() {
  # Codes 100/104/105/110 or the literal phrase — same rule the API client uses.
  grep -qiE 'Authentication Credentials failed|<(\w+:)?code>(100|104|105|110)<' <<< "$1"
}

# Masks the <password> value before anything gets printed or saved to a log
# a human will read — the request XML itself (with the real password) is
# only ever held in a local shell variable and sent directly to SanMar.
mask_password_in_xml() {
  sed -E 's#(<password>)[^<]*(</password>)#\1***MASKED***\2#' <<< "$1"
}

echo
echo "1. Sellable catalogue (getProductSellable ACTIVE) — read-only"
SELLABLE="$(soap "$PRODUCT_URL" "getProductSellable" "<GetProductSellableRequest xmlns=\"$NS_PD\">
        <wsVersion>2.0.0</wsVersion>
        <id>$ID</id>
        <password>$PW</password>
        <localizationCountry>CA</localizationCountry>
        <localizationLanguage>en</localizationLanguage>
        <productId>ACTIVE</productId>
        <partId></partId>
        <lineName></lineName>
        <isSellable>true</isSellable>
      </GetProductSellableRequest>")"

if auth_failed "$SELLABLE"; then
  echo "   AUTH FAILED — account ID or login e-mail rejected."
  echo "   $(first_tag "$SELLABLE" description)"
  exit 3
fi

PARTS="$(grep -oE '<([A-Za-z0-9._-]+:)?ProductSellable\b' <<< "$SELLABLE" | wc -l | tr -d ' ' || true)"
if [[ "$PARTS" == "0" ]]; then
  echo "   No sellable parts returned. First 600 chars of the reply:"
  echo "   $(head -c 600 <<< "$SELLABLE")"
  exit 4
fi
STYLE_LIST="$(grep -oE '<([A-Za-z0-9._-]+:)?productId>[^<(]+' <<< "$SELLABLE" | sed -E 's/^<[^>]*>//' | sort -u)"
STYLES="$(wc -l <<< "$STYLE_LIST" | tr -d ' ')"
# A real style from SanMar's own list, for the media test below — so that
# test can only fail on the password, never on a made-up style code.
SAMPLE_STYLE="$(head -1 <<< "$STYLE_LIST")"
printf '   %-32s %s\n' "sellable parts (SKUs)" "$PARTS"
printf '   %-32s %s\n' "unique active styles" "$STYLES"
printf '   %-32s %s\n' "we currently hold" "472 styles (audit of 11 Sep)"

echo
echo "2. Bulk Data — full diagnostic (getBulkData)"
EGRESS_IP="$(curl -s --max-time 10 https://checkip.amazonaws.com || echo "unknown")"
echo "   Egress IP for this run: $EGRESS_IP"
echo "   (This is the return address SanMar's server sees this call come from."
echo "    Compare it against the static IP on file with their EDI team — a"
echo "    mismatch here is the leading suspect for a Bulk-only rejection.)"

# Classifies a raw Bulk response into one word. Order matters: a daily-limit
# reply and an entitlement reply both use plain SOAP, so check the more
# specific phrases before falling back to "did it return real product rows".
classify_bulk_response() {
  local xml="$1"
  if grep -qi "not present" <<< "$xml" && grep -qiE "SOAP-ENV:Fault|<Fault" <<< "$xml"; then
    echo "http-fault-bad-request"; return
  fi
  if grep -qiE 'daily.?limit|rate.?limit|already.?called|1 call|<(\w+:)?code>125<' <<< "$xml"; then
    echo "daily-limit"; return
  fi
  if grep -qi 'not authorized user for this call' <<< "$xml"; then
    echo "not-authorized"; return
  fi
  if auth_failed "$xml"; then
    echo "auth-failed"; return
  fi
  local rows
  rows="$(grep -oE '<([A-Za-z0-9._-]+:)?(product|Product)\b' <<< "$xml" | wc -l | tr -d ' ' || true)"
  if [[ "${rows:-0}" != "0" ]]; then
    echo "success"; return
  fi
  echo "unrecognized-failure"
}

# Runs one Bulk attempt, saves the FULL raw response (success or failure —
# this is the change from the 11 Sep version, which only saved a success),
# and prints everything Khush asked for: the request we sent (password
# masked), the response, the timestamp, and every code/description/fault
# string found in it.
run_bulk_variant() {
  local label="$1" wsver="$2" id="$3" pw="$4"
  local run_ts request response outfile verdict
  run_ts="$(date -u +%Y%m%dT%H%M%SZ)"
  request="<GetBulkDataRequest xmlns=\"$NS_BULK\">
        <wsVersion>${wsver}</wsVersion>
        <id>${id}</id>
        <password>${pw}</password>
      </GetBulkDataRequest>"

  echo
  echo "   --- Variant: $label (wsVersion=$wsver, id=$id) ---"
  echo "   Timestamp (UTC): $run_ts"
  echo "   URL called: $BULK_URL"
  echo "   Request sent (password masked):"
  mask_password_in_xml "$request" | sed 's/^/     /'

  response="$(soap "$BULK_URL" "getBulkData" "$request")"
  outfile="$HOME/sanmar-bulk-${label}-${run_ts}.xml"
  printf '%s' "$response" > "$outfile"
  echo "   Full raw response saved to: $outfile"
  echo "   First 800 chars of response:"
  head -c 800 <<< "$response" | sed 's/^/     /'
  echo
  echo "   Codes / descriptions / fault strings found in the response:"
  { grep -oE '<([A-Za-z0-9._-]+:)?code>[^<]*</([A-Za-z0-9._-]+:)?code>' <<< "$response" || true; } | sed 's/^/     /'
  { grep -oE '<([A-Za-z0-9._-]+:)?description>[^<]*</([A-Za-z0-9._-]+:)?description>' <<< "$response" || true; } | sed 's/^/     /'
  { grep -oE '<([A-Za-z0-9._-]+:)?faultstring>[^<]*</([A-Za-z0-9._-]+:)?faultstring>' <<< "$response" || true; } | sed 's/^/     /'

  verdict="$(classify_bulk_response "$response")"
  echo "   Verdict: $verdict"
  echo "$verdict"
}

BULK_FINAL_STATE="not-run"

echo
echo "   Control test first — SanMar's own published sandbox account. This is a"
echo "   different account from ours, so it never spends our one daily call."
SANDBOX_VERDICT="$(run_bulk_variant "sandbox" "1.0.0" "$SANDBOX_ID" "$SANDBOX_PASSWORD" | tail -1)"

if [[ "$SANDBOX_VERDICT" == "success" ]]; then
  echo
  echo "   >>> Sandbox succeeded from this IP/request shape. If account $SANMAR_ACCOUNT_ID"
  echo "       still fails below, the request shape and this IP are both fine —"
  echo "       point back to SanMar: it is specific to our account."
elif [[ "$SANDBOX_VERDICT" == "not-authorized" || "$SANDBOX_VERDICT" == "http-fault-bad-request" || "$SANDBOX_VERDICT" == "auth-failed" ]]; then
  echo
  echo "   >>> Even SanMar's own sandbox account was rejected the same way from this"
  echo "       IP. That points at this IP/environment, not at our account."
fi

echo
echo "   Now the real account — trying wsVersion variants, stopping the instant"
echo "   one returns real product rows (that spends today's one call)."
for WSVER in "1.0.0" "1.0" "1"; do
  VARIANT_VERDICT="$(run_bulk_variant "acct-ws${WSVER//./}" "$WSVER" "$ID" "$PW" | tail -1)"
  if [[ "$VARIANT_VERDICT" == "success" ]]; then
    echo
    echo "   >>> SUCCESS with wsVersion=$WSVER. Stopping — today's call is now spent."
    BULK_FINAL_STATE="success (wsVersion=$WSVER)"
    break
  fi
  if [[ "$VARIANT_VERDICT" == "daily-limit" ]]; then
    echo
    echo "   >>> Daily limit already reached today for this account. Stopping — this"
    echo "       itself only happens on an entitled account, so Bulk IS enabled."
    BULK_FINAL_STATE="entitled, daily limit already used"
    break
  fi
  BULK_FINAL_STATE="all variants failed: last verdict = $VARIANT_VERDICT"
done

echo
echo "3. Media service (getMediaContent) — tests the media password on one style"
if [[ -z "${SANMAR_MEDIA_PASSWORD:-}" ]]; then
  echo "   skipped — no media password entered"
else
  MEDIA="$(soap "$MEDIA_URL" "getMediaContent" "<GetMediaContentRequest xmlns=\"$NS_MEDIA\">
        <wsVersion xmlns=\"$NS_MEDIA_SO\">1.1.0</wsVersion>
        <id xmlns=\"$NS_MEDIA_SO\">$ID</id>
        <password xmlns=\"$NS_MEDIA_SO\">$MPW</password>
        <cultureName xmlns=\"$NS_MEDIA_SO\">en</cultureName>
        <mediaType xmlns=\"$NS_MEDIA_SO\">Image</mediaType>
        <productId xmlns=\"$NS_MEDIA_SO\">$(xml_escape "$SAMPLE_STYLE")</productId>
        <partId xmlns=\"$NS_MEDIA_SO\"></partId>
        <classType>1006</classType>
      </GetMediaContentRequest>")"
  if auth_failed "$MEDIA"; then
    echo "   MEDIA PASSWORD REJECTED — this is not the EDI media password."
    echo "   $(first_tag "$MEDIA" description)"
    echo "   (It is probably the website login password, which the API does not use.)"
  else
    PHOTOS="$(grep -oE '<([A-Za-z0-9._-]+:)?MediaContent\b' <<< "$MEDIA" | wc -l | tr -d ' ' || true)"
    if [[ "${PHOTOS:-0}" == "0" ]]; then
      echo "   Media answered but returned no photos for style $SAMPLE_STYLE. First 600 chars:"
      echo "   $(head -c 600 <<< "$MEDIA")"
    else
      printf '   %-32s %s\n' "MEDIA PASSWORD" "works"
      printf '   %-32s %s\n' "photos for style $SAMPLE_STYLE" "$PHOTOS"
      echo "   Photos can be fetched style by style for every style, with no wait on SanMar."
    fi
  fi
fi

echo
echo "Summary"
printf '   %-32s %s\n' "credentials" "correct (Product Data succeeded)"
printf '   %-32s %s\n' "SanMar active styles" "$STYLES"
printf '   %-32s %s\n' "egress IP this run" "$EGRESS_IP"
printf '   %-32s %s\n' "Bulk — sandbox account" "$SANDBOX_VERDICT"
printf '   %-32s %s\n' "Bulk — our account ($SANMAR_ACCOUNT_ID)" "$BULK_FINAL_STATE"
echo
echo "   Every raw Bulk response from this run is saved under ~/sanmar-bulk-*.xml"
echo "   — send the relevant one(s) back, they contain no credentials."
