# AWS infrastructure (Terraform)

Provisions the production stack described in [`docs/AWS_DEPLOYMENT.md`](../../docs/AWS_DEPLOYMENT.md):

- VPC (public + private), NAT, security groups
- ECR (`web`, `commerce-api`)
- RDS PostgreSQL 16 (private)
- S3 uploads bucket (private, versioned, encrypted)
- Cognito user pool + confidential app client
- Secrets Manager app secret (DB URL, sessions, Cognito, placeholders for vendors/email)
- ALB + target groups (`/api/health`, `/health`)
- ECS Fargate cluster + services (optional on first apply)
- Cloud Map private DNS so web → `http://api.<prefix>.local:4000`
- GitHub Actions OIDC deploy role

## Prerequisites

- Terraform >= 1.6
- AWS credentials with rights to create VPC/ECS/RDS/IAM/etc.
- Docker (for the bootstrap image push)

## Quick start

```sh
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars

# Guided bring-up (recommended):
../../scripts/aws-bootstrap.sh
```

Or manually:

```sh
terraform init
terraform apply -var='create_ecs_services=false'
# push images to the ECR URLs from outputs
terraform apply -var='create_ecs_services=true'
```

## After apply — GitHub Actions

Create a GitHub Environment named `production` (optional but referenced by the workflow) and set repository **Variables**:

| Variable | Terraform output |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | `github_deploy_role_arn` |
| `AWS_REGION` | `aws_region` |
| `ECR_WEB_REPOSITORY` | `ecr_web_repository_url` |
| `ECR_API_REPOSITORY` | `ecr_api_repository_url` |
| `ECS_CLUSTER_NAME` | `ecs_cluster_name` |
| `ECS_WEB_SERVICE_NAME` | `ecs_web_service_name` |
| `ECS_API_SERVICE_NAME` | `ecs_api_service_name` |

Workflow: [`.github/workflows/deploy-aws.yml`](../../.github/workflows/deploy-aws.yml) runs on `main` and `workflow_dispatch`.

## Secrets to fill after apply

Update the Secrets Manager secret (`secrets_manager_secret_arn`) with real values for:

- `RESEND_API_KEY`
- `SS_ACCOUNT_NUMBER` / `SS_API_KEY`
- `SANMAR_ACCOUNT_ID` / `SANMAR_LOGIN_EMAIL` / `SANMAR_MEDIA_PASSWORD`

Then force a new ECS deployment so tasks pick up the secret version.

## Migrations

Never run migrations on container boot. From a machine/task that can reach RDS:

```sh
export DATABASE_URL="$(aws secretsmanager get-secret-value \
  --secret-id gwg-prod/app --query SecretString --output text | jq -r .DATABASE_URL)"
npm ci
npm run db:migrate
```

## HTTPS / DNS

Set `web_domain`, `api_domain`, `route53_zone_id`, and `enable_https = true`, then `terraform apply`.
