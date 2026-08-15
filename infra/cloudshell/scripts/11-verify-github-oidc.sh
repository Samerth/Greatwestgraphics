#!/usr/bin/env bash
# Diagnose "Not authorized to perform sts:AssumeRoleWithWebIdentity".
#
# AWS returns that one message whether the OIDC provider is missing, the role is
# missing, or the trust policy does not match the workflow, so this checks each
# cause separately and says which one is actually wrong. Read-only apart from
# adding the sts.amazonaws.com audience, which 07-create-ecr.sh cannot repair on
# a provider that already existed.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_command aws
require_command jq

PROVIDER_HOST="token.actions.githubusercontent.com"
ROLE_NAME="$NAME_PREFIX-github-ecr"
EXPECTED_SUB="repo:$GITHUB_ORG/$GITHUB_REPO:ref:refs/heads/main"

problems=()
note() { printf '  %s\n' "$1"; }
fail() { problems+=("$1"); printf '  FAIL  %s\n' "$1"; }
pass() { printf '  ok    %s\n' "$1"; }

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PROVIDER_ARN="arn:aws:iam::$ACCOUNT_ID:oidc-provider/$PROVIDER_HOST"
echo "Account $ACCOUNT_ID, region $AWS_REGION"

echo
echo "1. GitHub OIDC identity provider"
if provider="$(aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "$PROVIDER_ARN" 2>/dev/null)"; then
  pass "provider exists: $PROVIDER_ARN"
  if jq -e '.ClientIDList | index("sts.amazonaws.com")' <<<"$provider" >/dev/null; then
    pass "audience sts.amazonaws.com is registered"
  else
    note "audience sts.amazonaws.com missing; adding it"
    aws iam add-client-id-to-open-id-connect-provider \
      --open-id-connect-provider-arn "$PROVIDER_ARN" \
      --client-id sts.amazonaws.com
    pass "audience added"
  fi
else
  fail "no OIDC provider for $PROVIDER_HOST (re-run 07-create-ecr.sh)"
fi

echo
echo "2. Deploy role"
if role="$(aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null)"; then
  ROLE_ARN="$(jq -r '.Role.Arn' <<<"$role")"
  pass "role exists: $ROLE_ARN"
  trust="$(jq '.Role.AssumeRolePolicyDocument' <<<"$role")"

  if jq -e --arg arn "$PROVIDER_ARN" \
    '[.Statement[].Principal.Federated?] | flatten | index($arn)' <<<"$trust" >/dev/null; then
    pass "trusts the OIDC provider"
  else
    fail "trust policy does not name $PROVIDER_ARN"
  fi

  if jq -e '[.Statement[].Condition.StringEquals?."token.actions.githubusercontent.com:aud"]
            | flatten | index("sts.amazonaws.com")' <<<"$trust" >/dev/null; then
    pass "audience condition is sts.amazonaws.com"
  else
    fail "trust policy does not require audience sts.amazonaws.com"
  fi

  # StringLike patterns use glob semantics, which bash [[ == ]] mirrors closely
  # enough to tell whether this workflow's subject would be accepted.
  subs="$(jq -r '[.Statement[].Condition.StringLike?."token.actions.githubusercontent.com:sub"]
                 | flatten | .[]? // empty' <<<"$trust")"
  matched=false
  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    # shellcheck disable=SC2053
    if [[ "$EXPECTED_SUB" == $pattern ]]; then matched=true; fi
  done <<<"$subs"
  if [[ "$matched" == true ]]; then
    pass "accepts subject $EXPECTED_SUB"
  else
    fail "no subject pattern matches $EXPECTED_SUB"
    while IFS= read -r pattern; do
      [[ -n "$pattern" ]] && note "configured: $pattern"
    done <<<"$subs"
  fi

  if aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name ecr-push >/dev/null 2>&1; then
    pass "inline policy ecr-push attached"
  else
    fail "inline policy ecr-push missing (re-run 07-create-ecr.sh)"
  fi
else
  ROLE_ARN=""
  fail "no role named $ROLE_NAME (re-run 07-create-ecr.sh)"
fi

echo
echo "3. ECR repositories"
for repo in gwg-web gwg-commerce-api; do
  if aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1; then
    if aws ecr describe-images --repository-name "$repo" \
      --image-ids imageTag=latest >/dev/null 2>&1; then
      pass "$repo exists and has a :latest image"
    else
      pass "$repo exists (no :latest image yet — that is what the workflow pushes)"
    fi
  else
    fail "ECR repository $repo missing (re-run 07-create-ecr.sh)"
  fi
done

echo
if ((${#problems[@]} == 0)); then
  echo "All checks passed."
  echo
  echo "Set this as the GitHub Actions secret AWS_ROLE_TO_ASSUME, exactly:"
  echo "  $ROLE_ARN"
  echo "Then run Actions > AWS ECR > Run workflow from main."
else
  echo "${#problems[@]} problem(s) found:"
  for p in "${problems[@]}"; do echo "  - $p"; done
  echo
  echo "Most are fixed by re-running: ./scripts/07-create-ecr.sh"
  exit 1
fi
