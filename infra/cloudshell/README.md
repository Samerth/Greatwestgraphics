# AWS CloudShell provisioning (Great West Graphics)

This package creates the AWS resources the storefront and `commerce-api` need.
Run it **in AWS CloudShell** while you are logged into the correct account.
It cannot be executed from Cursor: this environment has no AWS credentials, and
nobody can complete the AWS console login on your behalf.

ChatGPT’s earlier zip only created RDS. These scripts keep that RDS path and
continue through S3, Cognito, ECR, secrets, and ECS/ALB.

Canonical app docs: [`docs/AWS_DEPLOYMENT.md`](../../docs/AWS_DEPLOYMENT.md).

## What you get

| Step | Script | Creates |
| --- | --- | --- |
| 0 | `00-preflight.sh` | Nothing. Checks region, CIDR, identity. |
| 1 | `01-create-rds.sh` | VPC, public subnets, IGW, RDS PostgreSQL 16, Secrets Manager master password, CAD 250 budget + USD billing alarm |
| 2 | `02-migrate-drizzle.sh` **(preferred)** | Applies this repo’s Drizzle migrations |
| 2 alt | `02-migrate-supabase.sh` | Optional `pg_dump` of a Supabase `public` schema. Skip unless GWG data already lives in Supabase. |
| 3 | `03-verify.sh` | RDS checks (TLS, encryption, no `0.0.0.0/0`) |
| 4 | `04-update-allowed-ip.sh` | Replace the trusted SQL client CIDR |
| 5 | `05-create-s3.sh` | Private versioned uploads bucket |
| 6 | `06-create-cognito.sh` | User pool + confidential app client (`USER_AUTH` / email OTP + password) |
| 7 | `07-create-ecr.sh` | `gwg-web` + `gwg-commerce-api` repos and a GitHub OIDC deploy role |
| 8 | `08-create-app-secrets.sh` | `gwg-prod/web` and `gwg-prod/api` secrets |
| 9 | `09-create-ecs.sh` | ALB, Fargate services, security groups, task roles |
| 10 | `10-print-outputs.sh` | Non-secret summary |

RDS is **publicly addressable but not open**. Port 5432 is limited to
`PUBLIC_DB_ALLOWED_CIDR` plus the commerce-api security group after step 9.
Never use `0.0.0.0/0`.

This first ECS pass is **HTTP on the ALB DNS name** (port 80 → web, port 4000 →
API) so you can smoke-test without a domain. Add ACM + Route 53 before a public
launch. There is no NAT gateway (Fargate tasks use `assignPublicIp=ENABLED`) to
keep the CAD 250 budget realistic.

## Before running

1. Open **AWS CloudShell** in `ca-central-1`.
2. Clone this repository (needed for Drizzle SQL and so you are not stuck with
   an old zip):

   ```bash
   git clone https://github.com/Samerth/Greatwestgraphics.git
   cd Greatwestgraphics/infra/cloudshell
   ```

   If you already ran the older `gwg-rds-cloudshell.zip`, copy
   `.gwg-rds-state/` into this folder so later scripts reuse the same VPC/RDS.
3. Find your public IPv4 (`curl -fsS https://checkip.amazonaws.com`) and set it
   in `config.env` as `PUBLIC_DB_ALLOWED_CIDR=x.x.x.x/32`.
4. Confirm the SNS/budget email `greatwestgraphics12@gmail.com` is an inbox you
   can access.

Do not paste database passwords, Cognito client secrets, or vendor API keys into
chat or into `config.env`.

## Run

```bash
chmod +x scripts/*.sh
./scripts/00-preflight.sh
./scripts/01-create-rds.sh          # waits until RDS is available
./scripts/02-migrate-drizzle.sh     # skip 02-migrate-supabase.sh unless you have GWG data in Supabase
./scripts/03-verify.sh
./scripts/05-create-s3.sh
./scripts/06-create-cognito.sh
./scripts/07-create-ecr.sh
./scripts/08-create-app-secrets.sh
./scripts/09-create-ecs.sh
./scripts/10-print-outputs.sh
```

RDS creation commonly takes several minutes. Each script is idempotent enough
to re-run after a failure.

## Push container images

CloudShell has ~2 GiB RAM and usually cannot build the Next.js image. After
step 7:

1. GitHub → repo **Settings → Secrets and variables → Actions**
2. Add `AWS_ROLE_TO_ASSUME` = the OIDC role ARN printed by `07-create-ecr.sh`
3. Run **Actions → AWS ECR → Run workflow** from `main` (the OIDC role only trusts `main`)
4. Re-run `./scripts/09-create-ecs.sh` so desired count becomes 1

## Smoke checklist

```bash
curl -fsS "$API_URL/health"
curl -fsS "$API_URL/ready"
curl -fsS "$SITE_URL/api/health"
```

Staff login is `/admin/login`. Username defaults to `admin`. Password:

```bash
aws secretsmanager get-secret-value --secret-id gwg-prod/web \
  --query SecretString --output text | jq -r .STAFF_ADMIN_PASSWORD
```

## Production blockers this pack does not remove

- `commerce-api` still fails closed for business routes until production auth is
  wired. Cognito on the web app does not yet authorize job APIs.
- `ENABLE_DEV_ADMIN_ROUTES` is forced `false`. Do not copy Compose fixture IDs
  into ECS.
- Stripe / CodCRM are not provisioned.
- Put `RESEND_API_KEY` and vendor keys into the Secrets Manager JSON when you
  have them; empty placeholders are created so tasks can start.
- Confirm the budget SNS email subscription.

## Change the trusted SQL client IP

Edit `PUBLIC_DB_ALLOWED_CIDR` in `config.env`, then:

```bash
./scripts/04-update-allowed-ip.sh
```
