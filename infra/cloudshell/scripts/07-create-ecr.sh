#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state ACCOUNT_ID
require_command aws
require_command jq

create_repo() {
  local name="$1"
  if aws ecr describe-repositories --repository-names "$name" >/dev/null 2>&1; then
    echo "ECR repository exists: $name"
  else
    aws ecr create-repository --repository-name "$name" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 \
      --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null
    echo "Created ECR repository $name"
  fi
  aws ecr set-repository-policy --repository-name "$name" --policy-text "$(jq -nc \
    --arg account "$ACCOUNT_ID" \
    '{Version:"2012-10-17",Statement:[{Sid:"AllowAccountPull",Effect:"Allow",Principal:{AWS:"arn:aws:iam::\($account):root"},Action:["ecr:GetDownloadUrlForLayer","ecr:BatchGetImage","ecr:BatchCheckLayerAvailability"]}]}')" >/dev/null || true
}

create_repo gwg-web
create_repo gwg-commerce-api

WEB_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gwg-web"
API_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gwg-commerce-api"
save_state WEB_ECR_URI "$WEB_REPO"
save_state API_ECR_URI "$API_REPO"

OIDC_URL="https://token.actions.githubusercontent.com"
if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn \
  "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" >/dev/null 2>&1; then
  # Thumbprint is unused when the audience is sts.amazonaws.com on current AWS,
  # but the API still requires at least one value.
  aws iam create-open-id-connect-provider \
    --url "$OIDC_URL" \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null
fi

ROLE_NAME="$NAME_PREFIX-github-ecr"
# sts:TagSession is required as well as AssumeRoleWithWebIdentity: some versions
# of configure-aws-credentials tag the session, and a trust policy that omits it
# denies the whole call with the same generic "not authorized" message.
#
# Two subject shapes are accepted. GitHub may send the plain
# "repo:owner/name:..." or an immutable form that appends numeric IDs,
# "repo:owner@1234/name@5678:...", which survives a rename of either. Neither a
# login nor a repository name may contain "@", so the wildcard can only ever
# stand in for that trailing ID and cannot widen the match to another repo.
TRUST="$(jq -nc --arg account "$ACCOUNT_ID" --arg org "$GITHUB_ORG" --arg repo "$GITHUB_REPO" \
  '{Version:"2012-10-17",Statement:[{Effect:"Allow",Principal:{Federated:"arn:aws:iam::\($account):oidc-provider/token.actions.githubusercontent.com"},Action:["sts:AssumeRoleWithWebIdentity","sts:TagSession"],Condition:{StringEquals:{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com"},StringLike:{"token.actions.githubusercontent.com:sub":["repo:\($org)/\($repo):ref:refs/heads/main","repo:\($org)@*/\($repo)@*:ref:refs/heads/main","repo:\($org)/\($repo):environment:aws","repo:\($org)@*/\($repo)@*:environment:aws","repo:\($org)/\($repo):environment:production","repo:\($org)@*/\($repo)@*:environment:production"]}}}]}')"
# GitHub's AWS_ROLE_TO_ASSUME is the prod-named role. It must be able to roll
# staging on every main push and to retarget prod only when the promote
# workflow runs. RegisterTaskDefinition + PassRole are required to change the
# image; UpdateService alone restarts the previous tag.
POLICY="$(jq -nc --arg account "$ACCOUNT_ID" --arg region "$AWS_REGION" \
  '{
    Version: "2012-10-17",
    Statement: [
      {Effect:"Allow",Action:["ecr:GetAuthorizationToken"],Resource:"*"},
      {Effect:"Allow",Action:["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage","ecr:DescribeImages","ecr:DescribeRepositories"],Resource:["arn:aws:ecr:\($region):\($account):repository/gwg-web","arn:aws:ecr:\($region):\($account):repository/gwg-commerce-api"]},
      {Effect:"Allow",Action:["ecs:RegisterTaskDefinition","ecs:DescribeTaskDefinition"],Resource:"*"},
      {Effect:"Allow",Action:["ecs:DescribeClusters"],Resource:["arn:aws:ecs:\($region):\($account):cluster/gwg-staging","arn:aws:ecs:\($region):\($account):cluster/gwg-prod"]},
      {Effect:"Allow",Action:["ecs:UpdateService","ecs:DescribeServices"],Resource:["arn:aws:ecs:\($region):\($account):service/gwg-staging/gwg-staging-web","arn:aws:ecs:\($region):\($account):service/gwg-staging/gwg-staging-api","arn:aws:ecs:\($region):\($account):service/gwg-prod/gwg-prod-web","arn:aws:ecs:\($region):\($account):service/gwg-prod/gwg-prod-api"]},
      {Effect:"Allow",Action:["iam:PassRole"],Resource:["arn:aws:iam::\($account):role/gwg-staging-ecs-task","arn:aws:iam::\($account):role/gwg-staging-ecs-execution","arn:aws:iam::\($account):role/gwg-prod-ecs-task","arn:aws:iam::\($account):role/gwg-prod-ecs-execution"],Condition:{StringEquals:{"iam:PassedToService":"ecs-tasks.amazonaws.com"}}},
      {Effect:"Allow",Action:["secretsmanager:GetSecretValue"],Resource:["arn:aws:secretsmanager:\($region):\($account):secret:gwg-staging/api*","arn:aws:secretsmanager:\($region):\($account):secret:gwg-prod/api*"]}
    ]
  }')"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST"
else
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST" \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name ecr-push --policy-document "$POLICY"
GITHUB_ECR_ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
save_state GITHUB_ECR_ROLE_ARN "$GITHUB_ECR_ROLE_ARN"

echo "ECR web:  $WEB_REPO"
echo "ECR api:  $API_REPO"
echo "GitHub OIDC role: $GITHUB_ECR_ROLE_ARN"
echo "Add GitHub Actions secret AWS_ROLE_TO_ASSUME with that ARN, then run workflow aws-ecr.yml"
echo "This role may retarget gwg-staging (main push) and gwg-prod (Promote to production)."
echo "Do not docker build the Next.js image in CloudShell (2 GiB RAM is usually too small)."
