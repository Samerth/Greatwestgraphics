#!/usr/bin/env bash
# Show what STS actually rejected, from AWS's own records.
#
# 11-verify-github-oidc.sh checks that the provider, role and trust policy look
# right, but it can only inspect what should happen. When it passes and the
# workflow still fails, the disagreement is between the role we inspected and
# the request GitHub really sent. CloudTrail holds that request: the role ARN
# asked for, the token subject presented, and the denial reason. Read-only.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_command aws
require_command jq

EXPECTED_ROLE_ARN="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/$NAME_PREFIX-github-ecr"
LOOKBACK_MINUTES="${LOOKBACK_MINUTES:-180}"

# Regional STS calls are recorded in that region; the global endpoint records to
# us-east-1. The workflow uses ca-central-1, but check both so a region mix-up
# cannot hide the event.
REGIONS="$AWS_REGION us-east-1"

echo "Looking for AssumeRoleWithWebIdentity in the last $LOOKBACK_MINUTES minutes"
echo "Expected role: $EXPECTED_ROLE_ARN"

START_TIME="$(date -u -d "-$LOOKBACK_MINUTES minutes" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v-"${LOOKBACK_MINUTES}"M +%Y-%m-%dT%H:%M:%SZ)"

found_any=false
for region in $REGIONS; do
  echo
  echo "== region $region =="
  events="$(aws cloudtrail lookup-events \
    --region "$region" \
    --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
    --start-time "$START_TIME" \
    --max-results 20 \
    --query 'Events[].CloudTrailEvent' \
    --output json 2>/dev/null || echo '[]')"

  count="$(jq 'length' <<<"$events")"
  if [[ "$count" == "0" ]]; then
    echo "  no events recorded here"
    continue
  fi
  found_any=true

  # Each element is a JSON string containing the event document.
  jq -r '.[]' <<<"$events" | while IFS= read -r raw; do
    jq -r --arg expected "$EXPECTED_ROLE_ARN" '
      . as $e
      | ($e.requestParameters.roleArn // "(not recorded)") as $asked
      | "  time     : \($e.eventTime)",
        "  outcome  : \($e.errorCode // "SUCCESS") \($e.errorMessage // "")",
        "  asked for: \($asked)",
        (if $asked != "(not recorded)" and $asked != $expected
         then "  MISMATCH : workflow requested a different role than the one provisioned"
         else empty end),
        "  subject  : \($e.userIdentity.userName // $e.requestParameters.roleSessionName // "(not recorded)")",
        ""
    ' <<<"$raw" 2>/dev/null || true
  done
done

echo
if [[ "$found_any" == false ]]; then
  cat <<EOF
No AssumeRoleWithWebIdentity events found.

CloudTrail records the attempt even when it is denied, so seeing nothing here
usually means the request never reached this AWS account -- the role ARN in the
GitHub secret points at a different account. Compare the account number in the
secret against this one:
  $(aws sts get-caller-identity --query Account --output text)

Note CloudTrail can lag a few minutes; re-run shortly after a workflow run.
EOF
else
  cat <<'EOF'
Read the "asked for" line above against the expected role. If they differ, fix
the AWS_ROLE_TO_ASSUME secret. If they match and the outcome is still an error,
the errorMessage is AWS's own reason for the denial.
EOF
fi
