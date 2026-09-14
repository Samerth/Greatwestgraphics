#!/usr/bin/env bash
# Answers the SanMar questions left open on 11 September, from an AWS Canada
# IP, without writing anything to any GWG system:
#
#   1. How many styles does SanMar actually list, against the 472 we hold?
#      (getProductSellable — read-only, no daily limit.)
#   2. Is Bulk Data entitled on this account?
#      (getBulkData — one call per day. A success spends today's call, so the
#      response is saved to ~/sanmar-bulk-probe.xml rather than thrown away.
#      A "not authorized" answer spends nothing and can be re-run freely.)
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
# are never printed. Only counts and verdicts are shown.
set -Eeuo pipefail

BASE="${SANMAR_API_BASE_URL:-https://edi.atc-apparel.com}"
PRODUCT_URL="$BASE/pstd/productdata2.0/ProductDataServiceV2.php"
BULK_URL="$BASE/bulk-data/BulkDataService.php"
MEDIA_URL="$BASE/pstd/mediacontent1.1/MediaContentService.php"
NS_PD="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/"
NS_BULK="https://edi.atc-apparel.com/bulk-data/"
NS_MEDIA="http://www.promostandards.org/WSDL/MediaService/1.0.0/"
NS_MEDIA_SO="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/"
OUT="$HOME/sanmar-bulk-probe.xml"

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

PARTS="$(grep -oE '<([A-Za-z0-9._-]+:)?ProductSellable\b' <<< "$SELLABLE" | wc -l | tr -d ' ')"
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
echo "2. Bulk Data entitlement (getBulkData) — one call per day"
BULK="$(soap "$BULK_URL" "getBulkData" "<GetBulkDataRequest xmlns=\"$NS_BULK\">
        <wsVersion>1.0.0</wsVersion>
        <id>$ID</id>
        <password>$PW</password>
      </GetBulkDataRequest>")"

BULK_STATE="unknown"
if grep -qi 'not authorized user for this call' <<< "$BULK"; then
  BULK_STATE="no"
  echo "   ENTITLED: NO"
  echo "   Bulk Data is a separate SanMar entitlement and this account does not have it."
  echo "   Ask SanMar's EDI team (edi@sanmarcanada.com) to enable it — 11 Sep, action 6."
elif grep -qiE 'daily.?limit|rate.?limit|already.?called|1 call|<(\w+:)?code>125<' <<< "$BULK"; then
  BULK_STATE="yes-used"
  echo "   ENTITLED: yes — but today's call is already used"
elif auth_failed "$BULK"; then
  echo "   AUTH FAILED on Bulk — $(first_tag "$BULK" description)"
  exit 3
else
  BULK_ROWS="$(grep -oE '<([A-Za-z0-9._-]+:)?(product|Product)\b' <<< "$BULK" | wc -l | tr -d ' ')"
  if [[ "$BULK_ROWS" == "0" ]]; then
    echo "   Bulk returned no products. First 600 chars of the reply:"
    echo "   $(head -c 600 <<< "$BULK")"
    exit 5
  fi
  BULK_STATE="yes"
  printf '%s' "$BULK" > "$OUT"
  printf '   %-32s %s\n' "ENTITLED" "yes"
  printf '   %-32s %s\n' "bulk product rows" "$BULK_ROWS"
  printf '   %-32s %s\n' "saved to" "$OUT"
fi

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
    PHOTOS="$(grep -oE '<([A-Za-z0-9._-]+:)?MediaContent\b' <<< "$MEDIA" | wc -l | tr -d ' ')"
    if [[ "$PHOTOS" == "0" ]]; then
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
printf '   %-32s %s\n' "credentials" "correct"
printf '   %-32s %s\n' "SanMar active styles" "$STYLES"
printf '   %-32s %s\n' "Bulk Data" "$BULK_STATE"
