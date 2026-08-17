#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

echo "=== GWG AWS CloudShell outputs (no secrets) ==="
echo "Account:              ${ACCOUNT_ID:-unset}"
echo "Region:               $AWS_REGION"
echo "VPC:                  ${VPC_ID:-unset}"
echo "RDS endpoint:         ${RDS_ENDPOINT:-unset}"
echo "RDS secret ARN:       ${DB_SECRET_ARN:-unset}"
echo "S3 bucket:            ${AWS_S3_BUCKET:-unset}"
echo "Cognito pool:         ${COGNITO_USER_POOL_ID:-unset}"
echo "Cognito client:       ${COGNITO_APP_CLIENT_ID:-unset}"
echo "Web ECR:              ${WEB_ECR_URI:-unset}"
echo "API ECR:              ${API_ECR_URI:-unset}"
echo "GitHub OIDC role:     ${GITHUB_ECR_ROLE_ARN:-unset}"
echo "ALB DNS:              ${ALB_DNS:-unset}"
echo "Storefront URL:       ${SITE_URL:-unset}"
echo "API URL:              ${API_URL:-unset} (internal to the VPC)"
echo "Migration:            ${MIGRATION_SOURCE:-not run} / tables=${MIGRATED_PUBLIC_TABLE_COUNT:-n/a}"
echo
echo "Staff password (trusted session only):"
echo "  aws secretsmanager get-secret-value --secret-id $NAME_PREFIX/web --query SecretString --output text | jq -r .STAFF_ADMIN_PASSWORD"
echo
echo "Smoke (from anywhere):"
echo "  curl -fsS ${SITE_URL:-http://ALB}/api/health"
echo
echo "The commerce API answers on a private address only, so these two run from"
echo "inside the VPC (an ECS exec session on a web task), not from CloudShell:"
echo "  curl -fsS ${API_URL:-http://internal-ALB:4000}/health"
echo "  curl -fsS ${API_URL:-http://internal-ALB:4000}/ready"
