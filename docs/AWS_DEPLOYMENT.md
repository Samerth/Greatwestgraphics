# AWS deployment guide (Great West Graphics)

Practical steps to run the storefront (Next.js) and `commerce-api` on AWS.
This repository does **not** provision cloud resources. Pair with
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for provider cost notes and the full
credential checklist.

## Target architecture (typical)

| Piece | AWS service | Notes |
| --- | --- | --- |
| Web (Next.js) | ECS Fargate behind ALB | Root `Dockerfile` (`output: "standalone"`). Amplify Hosting is an alternative if you want managed SSR without containers. |
| Commerce API | ECS Fargate behind ALB (same or separate service) | `services/commerce-api/Dockerfile`, port **4000**. |
| Database | RDS PostgreSQL (private subnets) | Or keep Neon/Supabase temporarily for staging; production should be private RDS. |
| Uploads / artwork | S3 (+ optional CloudFront) | Set `AWS_S3_BUCKET`, `AWS_REGION`, optional `AWS_S3_PUBLIC_BASE_URL`. |
| Secrets | Secrets Manager or SSM Parameter Store | Inject into task definitions; never bake secrets into images. |
| Identity | Cognito (wired in app) | Pool + confidential app client; see env checklist. |
| Email | Resend (current) or SES later | `RESEND_*` today; SES is the AWS-native path when you cut over. |
| DNS / TLS | Route 53 + ACM | Certificates in the ALB region (usually `us-east-1` only for CloudFront). |

App Runner remains a lighter alternative for the API (see `DEPLOYMENT.md`). Prefer
**ECS Fargate + ALB** when you want one VPC, private RDS, and shared networking
for web + API.

```text
Internet → ALB (HTTPS)
            ├─ /          → ECS service: web   :3000
            └─ /api-proxy → (optional) or separate host api.* → ECS: api :4000

Web tasks call commerce-api over the private service URL
(COMMERCE_API_BASE_URL=http://api.internal:4000 or the public API hostname).
```

Use **two hostnames** (recommended): `www.example.com` → web, `api.example.com` → API.
Point the Next.js server at the API with `COMMERCE_API_BASE_URL` (server-only).

## Build images

From the repository root (CI or laptop with Docker):

```sh
docker build -t gwg-web:latest .
docker build -f services/commerce-api/Dockerfile -t gwg-commerce-api:latest .
```

Push to ECR after authenticating:

```sh
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker tag gwg-web:latest "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gwg-web:latest"
docker tag gwg-commerce-api:latest "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gwg-commerce-api:latest"
docker push "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gwg-web:latest"
docker push "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gwg-commerce-api:latest"
```

Images run as non-root (`node`). Do not run migrations inside the app containers.

## Health checks

| Service | Path | Use |
| --- | --- | --- |
| API | `GET /health` | ALB / ECS liveness (process up) |
| API | `GET /ready` | Deploy smoke (DB reachable); 503 if DB down |
| Web | `GET /api/health` | ALB / ECS liveness |

Configure ALB target group health checks to `/health` (API) and `/api/health` (web),
HTTP 200, interval ~30s. Container `HEALTHCHECK` instructions match these paths.

## ECS Fargate sketch

1. VPC with public + private subnets, NAT for private egress (vendor APIs, Cognito, S3).
2. Security groups: ALB → web:3000 / api:4000; web → api:4000; api → RDS:5432.
3. RDS PostgreSQL in private subnets; encryption, backups, deletion protection.
4. Two ECR repos; two task definitions; two ECS services (desired count ≥ 2 in prod).
5. One ALB (or two) with HTTPS listeners and path/host rules.
6. Task roles: S3 object access for uploads; execution role: pull from ECR + read secrets.
7. CloudWatch log groups for each service.

### Task definition env (non-secret)

**API**

- `NODE_ENV=production`
- `COMMERCE_API_HOST=0.0.0.0`
- `COMMERCE_API_PORT=4000`
- `ENABLE_DEV_ADMIN_ROUTES=false` (**required** — API refuses `true` in production)

**Web**

- `NODE_ENV=production`
- `HOSTNAME=0.0.0.0` (set in image)
- `PORT=3000`
- `COMMERCE_API_BASE_URL=https://api.example.com` (or internal URL)
- `NEXT_PUBLIC_SITE_URL=https://www.example.com`

### Secrets (Secrets Manager / SSM → task secrets)

Map these from `.env.example` (values never committed):

| Secret / param | Service | Required in prod |
| --- | --- | --- |
| `DATABASE_URL` | API | Yes (RDS URL with TLS) |
| `STAFF_ADMIN_USER` / `STAFF_ADMIN_PASSWORD` | Web | Yes (staff `/admin`) |
| `STAFF_SESSION_SECRET` | Web | Yes (≥32 chars) |
| `CUSTOMER_SESSION_SECRET` | Web | Yes |
| `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID` / `COGNITO_APP_CLIENT_SECRET` | Web | Yes when customer auth is live |
| `AWS_S3_BUCKET` / `AWS_REGION` / optional `AWS_S3_PUBLIC_BASE_URL` | Web | Yes for durable uploads |
| `SS_ACCOUNT_NUMBER` / `SS_API_KEY` | API | If S&S sync is used |
| `SANMAR_ACCOUNT_ID` / `SANMAR_LOGIN_EMAIL` (or `SANMAR_API_PASSWORD`) | API | If SanMar sync is used |
| `RESEND_API_KEY` / `CONTACT_FROM_EMAIL` / `CONTACT_TO_EMAIL` | Web | If contact form sends mail |
| `DEV_ADMIN_TOKEN` | — | **Do not set in production** |

Leave development-only IDs unset in production (`COMMERCE_DEV_*`). Production
commerce scope must come from real auth / store resolution — not fixture headers.

## Database migrations

Run as an explicit release step (ECS one-off task, CI job with VPC access, or
bastion), **never** on container boot:

```sh
export DATABASE_URL="postgresql://..."
npm ci
npm run db:migrate
# optional, non-prod only:
# npm run db:seed
```

Apply pending Drizzle SQL under `services/commerce-api/drizzle/` before shifting
traffic after schema changes.

## S3 uploads

1. Private bucket, block public ACLs, SSE (SSE-S3 or KMS).
2. Versioning + lifecycle rules for proofs/artwork.
3. Bucket policy / task role: `s3:PutObject`, `s3:GetObject` on the prefix used by the app.
4. CORS: allow the storefront origin(s), methods needed by the browser upload flow.
5. Optional CloudFront distribution; set `AWS_S3_PUBLIC_BASE_URL` to the CDN origin URL.

Without `AWS_S3_BUCKET` + `AWS_S3_REGION`, the web app falls back to local
`.data/uploads` — unsuitable for multi-task Fargate.

## Local parity (Compose)

Development Compose (Postgres + API + web) lives in `compose.yaml`:

```sh
cp .env.example .env
docker compose up -d postgres
npm run db:migrate && npm run db:seed
docker compose up --build api web
```

Compose intentionally enables `ENABLE_DEV_ADMIN_ROUTES` and fixture tenant IDs.
That configuration must not be copied into ECS task definitions.

## Production blockers (do not ignore)

- `ENABLE_DEV_ADMIN_ROUTES` must be `false` (or unset) in production. The API
  validates this and will not start if it is `true` when `NODE_ENV=production`.
- Stripe / CodCRM production cutover still incomplete — see
  `IMPLEMENTATION_STATUS.md`. Containers do not remove those product blockers.
- Staff admin password auth is a bootstrap control plane; harden or replace
  before broad production exposure.
- Prefer GitHub OIDC → IAM role for ECR push / deploy; no long-lived AWS keys in the repo.

## Smoke checklist after first deploy

1. `curl -fsS https://api.example.com/health` → `{"status":"ok"}`
2. `curl -fsS https://api.example.com/ready` → ready (DB up)
3. `curl -fsS https://www.example.com/api/health` → `{"status":"ok"}`
4. Storefront homepage loads over HTTPS
5. Staff `/admin/login` works with Secrets Manager credentials
6. Upload a design/artwork and confirm the object lands in S3
7. Vendor sync only after secrets + DB migrations are verified
