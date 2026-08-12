#!/usr/bin/env bash
# First-time AWS bring-up helper for Great West Graphics.
# Requires: aws CLI, terraform >= 1.6, docker, jq
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/infra/aws"

cd "$TF_DIR"

if [[ ! -f terraform.tfvars ]]; then
  cp terraform.tfvars.example terraform.tfvars
  echo "Created terraform.tfvars — edit domains/region, then re-run."
  exit 1
fi

echo "==> terraform init"
terraform init

echo "==> Phase 1: network, ECR, RDS, S3, secrets, Cognito, ALB (ECS services off)"
terraform apply -auto-approve -var='create_ecs_services=false'

ECR_WEB=$(terraform output -raw ecr_web_repository_url)
ECR_API=$(terraform output -raw ecr_api_repository_url)
REGION=$(terraform output -raw aws_region)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "==> Login ECR"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

echo "==> Build & push images"
cd "$ROOT"
docker build -t "$ECR_WEB:latest" .
docker push "$ECR_WEB:latest"
docker build -f services/commerce-api/Dockerfile -t "$ECR_API:latest" .
docker push "$ECR_API:latest"

echo "==> Phase 2: enable ECS services"
cd "$TF_DIR"
terraform apply -auto-approve -var='create_ecs_services=true'

echo "==> Outputs"
terraform output

cat <<EOF

Next:
  1. Put GitHub Actions variables from terraform outputs (see docs/AWS_DEPLOYMENT.md).
  2. Run DB migrations against RDS (Secrets Manager DATABASE_URL).
  3. Fill vendor/email keys in Secrets Manager secret from output secrets_manager_secret_arn.
  4. Attach custom domains / enable_https when ready.
EOF
