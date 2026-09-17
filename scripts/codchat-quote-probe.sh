#!/usr/bin/env bash
# Probe the CodChat estimate relay the way CodChat's connector calls it.
#
#   bash scripts/codchat-quote-probe.sh
#
# Prompts for the CodChat shared token (CODCHAT_LOOKUP_API_TOKEN) without
# echoing it, or reads it from CODCHAT_TOKEN if already exported. Never
# prints the token. Base URL defaults to staging; override with
# CODCHAT_RELAY_BASE=https://<site>/api/codchat.
#
# Each probe is a body CodChat is likely to send after a customer typed
# something, and the status the endpoint must answer with since 17 Sep:
# a price when the request can be priced, a 400 that names the reason when
# it cannot - never a 500. A 500 on the "sublimation" probe means staging
# still runs the previous build.
set -u

base="${CODCHAT_RELAY_BASE:-https://d1so4a0f4v7ki5.cloudfront.net/api/codchat}"
if [ -z "${CODCHAT_TOKEN:-}" ]; then
  read -r -s -p "CodChat shared token (hidden): " CODCHAT_TOKEN
  echo
fi
if [ -z "${CODCHAT_TOKEN:-}" ]; then
  echo "No token given." >&2
  exit 1
fi

probe() {
  local label="$1" expect="$2" body="$3" status
  local out
  out="$(mktemp)"
  status="$(curl -s -m 40 -o "$out" -w '%{http_code}' \
    -X POST "$base/pricing/quote" \
    -H "Authorization: Bearer $CODCHAT_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$body")"
  local mark="FAIL"
  [ "$status" = "$expect" ] && mark="ok  "
  printf '%s %s -> %s (want %s)\n' "$mark" "$label" "$status" "$expect"
  node -e '
    const fs = require("fs");
    let j; try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch { console.log("      (no JSON body)"); process.exit(0); }
    if (j && j.error) { console.log(`      ${j.error.code}: ${j.error.message}`); process.exit(0); }
    const b = j.breakdown || {};
    console.log(`      ${j.currency} ${j.unit_price} each, total ${j.total}, turnaround ${j.turnaround_days} days; garment ${b.garment_per_piece}/pc, setup ${b.setup_total}, rush ${b.rush_total}`);
  ' "$out"
  rm -f "$out"
}

echo "Relay: $base"
probe "screen print, no colour count, sku 5000        " 200 \
  '{"qty":24,"sku":"5000","decorations":[{"method":"screen_print","location":"front"}]}'
probe "dtg, no size, vague sku \"gildan t-shirt\"        " 200 \
  '{"qty":100,"sku":"gildan t-shirt","decorations":[{"method":"dtg","location":"front"}]}'
probe "embroidered, no stitch count, sku 18500       " 200 \
  '{"qty":50,"sku":"18500","decorations":[{"method":"embroidered","location":"left_chest"}]}'
probe "sublimation (not priced) -> 400               " 400 \
  '{"qty":24,"sku":"5000","decorations":[{"method":"sublimation","location":"front"}]}'
probe "10 colours on a screen print -> engine 400    " 400 \
  '{"qty":24,"sku":"5000","decorations":[{"method":"screenPrint","location":"front","colours":10}]}'
probe "rush on, 1 colour, sku 5000                   " 200 \
  '{"qty":100,"sku":"5000","rush":true,"decorations":[{"method":"screen_print","location":"front","colours":1}]}'
