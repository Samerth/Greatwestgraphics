# Deployment and integration runbook

This document reflects provider information checked on July 26, 2026. Provider
offers and prices change; verify the linked official pages before provisioning.
No cloud resource is created by this repository.

**Hands-on AWS cutover:** run [`infra/cloudshell/README.md`](../infra/cloudshell/README.md)
in AWS CloudShell (`ca-central-1`). Architecture notes:
[`AWS_DEPLOYMENT.md`](./AWS_DEPLOYMENT.md).

## Recommended path

Use one AWS region and keep the existing boundaries:

- Next.js storefront: **ECS Fargate + ALB** using the root `Dockerfile` is the
  primary path for a full AWS migration (see `AWS_DEPLOYMENT.md`). AWS Amplify
  Hosting remains a lighter alternative for Next.js SSR if you want managed
  hosting without operating web containers. App Runner can also run the web image.
- Commerce API: **ECS Fargate + ALB** (same VPC as RDS) for production networking.
  App Runner is still fine for a small operational footprint when a VPC connector
  + private RDS design is confirmed. App Runner has no dedicated free compute
  allowance and retains a provisioned-memory charge while idle.
- PostgreSQL: private RDS PostgreSQL for production, Multi-AZ and backups when
  the recovery requirements warrant their cost. Aurora PostgreSQL is compatible
  but is not automatically cheaper. Use Neon Free only for development or
  disposable staging.
- Artwork/proofs: a private, versioned S3 bucket with encryption, lifecycle
  rules, narrowly scoped presigned URLs, and explicit browser CORS origins.
- Email: SES after domain verification, DKIM, sandbox-exit approval, bounce and
  complaint handling, and sender-template decisions.
- Identity: Cognito is a reasonable AWS-native candidate, but it is not wired
  in. Decide the tenant/account claims and session contract before implementing
  it. Production commerce endpoints intentionally fail closed today.

RDS should not be publicly reachable. An App Runner VPC connector can reach a
private database, but internet-bound calls through that VPC may require NAT,
which is a meaningful fixed cost. Confirm the network design before creating
RDS. ECS/Fargate also charges for requested compute; ECS itself has no additional
Fargate orchestration fee.

## Free database choices for immediate development

Recommended: **Neon Free**. Create one project near the developer/API region,
copy its pooled PostgreSQL connection string into the ignored root `.env` as
`DATABASE_URL`, then run `npm run db:migrate` and `npm run db:seed`.

As currently documented, Neon Free is $0/month with 0.5 GB storage per project,
100 CU-hours per project per month, 5 GB public network transfer, scale-to-zero,
and limited restore history. Storage-increasing writes fail at the limit, and
sleep/resume can add latency. Treat it as development/disposable staging, not as
evidence of a production SLA or a permanent commercial commitment.

Alternatives:

- Local PostgreSQL 15+ is free and keeps data on the developer machine. The
  included Compose service uses PostgreSQL 16 and a deliberately local-only
  password.
- Supabase Free currently includes two active projects, 500 MB database size,
  5 GB egress, and 1 GB file storage. Free projects pause after one week of
  inactivity and do not include automatic backups. It is useful when Supabase
  Auth/Storage is also desired, but those services would be a separate
  architecture decision.

Official sources:

- Neon plans: https://neon.com/docs/introduction/plans
- Neon cost limits: https://neon.com/docs/introduction/cost-optimization
- Supabase pricing: https://supabase.com/pricing

## AWS free-tier and cost notes

AWS's current new-customer program is temporary: $100 of credits at signup and
up to $100 more through qualifying activities. The Free Plan ends after six
months or when credits are exhausted; credits expire 12 months after account
creation. RDS/Aurora exploration under this program is therefore not a
permanent free production database. Accounts created before July 15, 2025 may
instead retain a legacy RDS 12-month offer subject to its rules.

- RDS/Aurora: credit-backed, new-account exploration; Free Plan RDS eligibility
  includes specified `db.t3.micro`/`db.t4g.micro` engines. Budget for normal
  instance, storage, backup, transfer, and availability costs afterward.
- Amplify Hosting: usage-based build, CDN, transfer, and SSR request/duration
  charges with published free allowances. The pricing page also describes the
  new six-month account Free Plan; do not assume hosting remains free.
- App Runner: vCPU/memory usage plus provisioned memory while idle, and possible
  deployment/build charges. There is no dedicated free container allowance.
- ECS/Fargate: per-second requested vCPU, memory, and storage with a one-minute
  minimum; load balancer, logs, NAT, and transfer are separate.
- S3: usage-based storage, requests, retrieval, and transfer. New-customer
  credits may apply; configure a budget rather than assuming a permanent free
  artifact store.
- SES: usage-based email pricing; current new-customer credits may apply. A
  verified identity does not itself grant production sending access.
- Cognito: Lite/Essentials currently include an indefinite 10,000 direct/social
  MAU monthly free tier; SAML/OIDC federation has a much smaller 50-MAU free
  allowance, and machine-to-machine token requests and Plus do not have that
  free tier.

Official sources:

- AWS Free Tier and terms: https://aws.amazon.com/free/ and
  https://aws.amazon.com/free/terms/
- RDS/Aurora Free Tier: https://aws.amazon.com/rds/free/
- Amplify pricing and Next.js support:
  https://aws.amazon.com/amplify/pricing/ and
  https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html
- App Runner pricing: https://aws.amazon.com/apprunner/pricing/
- ECS pricing: https://aws.amazon.com/ecs/pricing/
- S3 pricing: https://aws.amazon.com/s3/pricing/
- SES pricing: https://aws.amazon.com/ses/pricing/
- Cognito pricing: https://aws.amazon.com/cognito/pricing/

## Local container workflow

`compose.yaml` is development-only (fixture tenant IDs +
`ENABLE_DEV_ADMIN_ROUTES=true`). Migrations remain an explicit operation and are
never run by an application container:

```sh
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
docker compose up --build api web
```

The root `.env` uses `localhost:5432` for host-run migration commands. Compose
injects the internal `postgres` hostname into the API.

Build the production images from repository root:

```sh
docker build -t gwg-web .
docker build -f services/commerce-api/Dockerfile -t gwg-commerce-api .
```

Health checks:

- API: `/health` (liveness), `/ready` (DB smoke)
- Web: `/api/health` (liveness)

Configure the platform health check to those liveness paths. Set the container
port to `4000` (API) or `3000` (web). In production task definitions,
`ENABLE_DEV_ADMIN_ROUTES` must be `false` or unset — the API refuses to start
otherwise. Run migrations as an explicit, reviewed release job before shifting
traffic.

## Exact prerequisites by milestone

Store secrets only in an ignored `.env` for local work and in the selected cloud
secret store for deployments. Do not paste secret values into chat, tickets, or
source control.

### 1. Development database

- `DATABASE_URL`: Neon pooled PostgreSQL URL with TLS, or local PostgreSQL URL.
- Optional `TEST_DATABASE_URL`: separate, migrated, disposable test database.
- Non-secret development scope IDs already documented in `.env.example`.
- Action: run `npm run db:migrate`, then `npm run db:seed`.

### 2. AWS foundation and first deployment

- AWS account type/age, billing owner, budget threshold, and billing alarms.
- Primary region and required data residency.
- IAM deployment role using GitHub/CI OIDC (preferred) or another short-lived
  federation method; no long-lived access keys in the repository.
- ECR repositories for API and, only if needed, web images.
- App Runner service or ECS cluster/service/task definition decision, CPU/RAM,
  autoscaling limits, health-check settings, CloudWatch log group, and VPC
  connector/subnets/security groups.
- Amplify app, repository/Git provider connection, branch mapping, build
  settings, runtime environment variables, and custom-domain mapping.
- RDS PostgreSQL instance/cluster choice, database name, generated application
  username/password or IAM-auth decision, private subnets/security groups,
  backup retention, deletion protection, encryption key, and migration-job path.
- Runtime `DATABASE_URL`, `COMMERCE_API_HOST=0.0.0.0`,
  `COMMERCE_API_PORT=4000`, and server-only `COMMERCE_API_BASE_URL`.
- S3 bucket name/region, encryption key choice, versioning/lifecycle policy,
  allowed object prefixes, maximum upload size/type, presigned URL lifetime,
  and exact CORS origins/methods/headers.
- SES verified domain and From/Reply-To addresses, DKIM DNS records, region,
  production-access approval, bounce/complaint topic or event destination, and
  sender templates.
- Route 53 hosted zone or external DNS access, exact web/API hostnames, ACM
  certificates in service-required regions, and redirect/cookie-domain policy.
- Observability destination, retention, alert contacts, uptime targets, and
  error/latency/5xx/database alarms.

### 3. Production identity

- Decision: Cognito or another explicit OIDC provider.
- If Cognito: user pool ID, region, app client ID (and secret only for a
  confidential server client), hosted UI/custom domain, callback/logout URLs,
  issuer/JWKS URLs, MFA/password policy, and email/SMS configuration.
- Approved mapping for user subject, tenant, account, store, person, and roles;
  account provisioning/revocation rules; cookie/session and CSRF contract.
- Implementation and security review of API JWT verification and web sessions
  are required before production business traffic. Development identity headers
  must not be enabled in production.

### 4. Payments

- Stripe account mode and owner; publishable and restricted/secret API keys.
- Webhook endpoint URL and signing secret for each environment.
- Currency, taxes, shipping, discounts, final-price approval, refunds,
  cancellation, capture timing, receipts, and idempotency policy.
- Stripe product/price mapping only if Prices are used; otherwise an approved
  server-side PaymentIntent amount contract.

### 5. CodCRM

- Environment-specific base URL and API documentation/version.
- OAuth authorization/token URLs, client ID, client secret, scopes, redirect
  URLs, service-account/tenant identity, and refresh-token policy.
- Entity/field/status mapping, idempotency and retry rules.
- Webhook event schema, callback URL, signing algorithm/secret, replay window,
  source IP ranges if enforced, and sandbox credentials.

### 6. Vendors

- Each vendor's sandbox/production base URLs, API version and documentation.
- Credential type and values, account/customer IDs, scopes, rotation owner, and
  allowed source IPs or mTLS certificates.
- Rate/concurrency limits, retry guidance, SLAs, catalog/SKU mapping, order and
  proof contracts, webhook schemas/signing/IP allowlists, and support contact.

### 7. Business policy and operations

- Authoritative custom pricing rules and approval authority.
- Tax nexus/rates/provider decision, exemptions, invoice requirements, and
  rounding rules.
- Shipping carriers/services, zones, package rules, pickup policy, lead times,
  duties, returns, cancellations, and production-release criteria.
- Artwork/proof formats, size/retention limits, approval evidence, and deletion
  policy.
- Transactional sender names, localized templates, legal footer, support
  address, and sending domain.
- Backup restore test, incident owner, data retention/deletion, privacy terms,
  audit requirements, and production go-live acceptance criteria.

## Known blockers

Payment (Stripe), CodCRM production cutover, and outbox delivery still need
product/credentials decisions — see `IMPLEMENTATION_STATUS.md`. Cognito, S3
uploads, Resend contact email, and vendor sync adapters are partially wired;
containerization does not finish those product blockers. Never enable
`ENABLE_DEV_ADMIN_ROUTES` in production.
