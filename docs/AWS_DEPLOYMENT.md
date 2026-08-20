# AWS deployment guide (Great West Graphics)

Practical steps to run the storefront (Next.js) and `commerce-api` on AWS.
Hands-on provisioning is the CloudShell pack in
[`infra/cloudshell/README.md`](../infra/cloudshell/README.md) — run those
scripts in **AWS CloudShell** in `ca-central-1` while logged into the target
account. Pair with [`DEPLOYMENT.md`](./DEPLOYMENT.md) for provider cost notes
and the full credential checklist.

## Target architecture (typical)

| Piece | AWS service | Notes |
| --- | --- | --- |
| Web (Next.js) | ECS Fargate behind ALB | Root `Dockerfile` (`output: "standalone"`). Amplify Hosting is an alternative if you want managed SSR without containers. |
| Commerce API | ECS Fargate behind ALB (same or separate service) | `services/commerce-api/Dockerfile`, port **4000**. |
| Database | RDS PostgreSQL (private subnets) | Or keep Neon/Supabase temporarily for staging; production should be private RDS. |
| Uploads / artwork | S3 (+ optional CloudFront) | Set `AWS_S3_BUCKET`, `AWS_REGION`, optional `AWS_S3_PUBLIC_BASE_URL`. |
| Secrets | Secrets Manager or SSM Parameter Store | Inject into task definitions; never bake secrets into images. |
| Identity | Cognito (wired in app) | Pool + confidential app client; see env checklist. |
| Email | Resend **and** SES, split by sender | Resend sends app mail (`RESEND_*`); SES sends Cognito auth mail. See [Email deliverability](#email-deliverability). |
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

A push to `main` runs `.github/workflows/aws-ecr.yml`, which moves `:latest`
and force-deploys the `gwg-staging` ECS services. That roll does nothing for
production. To bounce an environment by hand in CloudShell:

```sh
export CONFIG_FILE=config.staging.env
./scripts/17-roll-ecs.sh
```

Vercel is not part of this path. `vercel.json` turns off Git auto-deploys.
Disconnect the GitHub integration in the Vercel project settings so it stops
building at all. The storefront on AWS is the Next.js container behind
CloudFront; Vercel cannot run the Fastify commerce API.

Images run as non-root (`node`). Do not run migrations inside the app containers.

## Staging vs production

Both stacks are full copies: their own VPC, RDS, Cognito, S3, ECS, ALB, and
CloudFront. They share only the ECR repos (`gwg-web`, `gwg-commerce-api`).
That is the point — the image you tried on staging is the image you promote.

| | Staging (`gwg-staging`) | Production (`gwg-prod`) |
| --- | --- | --- |
| Purpose | Break things. Client demos. Sign-off. | Live customers. |
| How code gets there | Push to `main` builds images and rolls staging | A person chooses to promote. Never automatic. |
| Data | Its own database and uploads | Its own database and uploads. Never copy live PII back. |
| URL | `https://d1so4a0f4v7ki5.cloudfront.net` | Custom domain, once `14-create-cloudfront.sh` + DNS |

Do not treat a Vercel URL as staging. It has no API.

### How a “promote this SHA to prod” job would work

ECR already tags every `main` build with the Git commit, e.g.
`gwg-web:289b4002b977…` and `gwg-commerce-api:289b4002b977…`. Staging
currently follows `:latest` (whatever `main` last built). Production should
not.

A manual promote is a GitHub Action you click — **Actions → Promote to
production → Run workflow** — with one input: the commit SHA that staging
already runs. The job does **not** rebuild. It points `gwg-prod-web` and
`gwg-prod-api` at those two existing tags and starts a new deployment.

That is different from bouncing `:latest`. If you bounce prod on `:latest` a
week later, you may ship a newer `main` than the one you tested. Promoting a
SHA ships exactly the pair of images you signed off.

Before that job exists, the same move in CloudShell is:

```sh
export CONFIG_FILE=config.env          # production
export IMAGE_TAG=<the-staging-sha>
./scripts/09-create-ecs.sh             # registers task defs on that tag
```

Migrations stay a separate, reviewed step against the **prod** RDS
(`02-migrate-drizzle.sh` with the prod config). Never migrate as a side
effect of starting a container.

This promote job is not wired yet. Staging auto-roll is. Do not add an
automatic prod roll.

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

## Email deliverability

Two providers send mail as `greatwestgraphics.com`, split by who generates the
message. Resend sends anything the app composes: the contact form, team invites
and the proof notifications drained from `outbox_events`. SES sends anything
Cognito composes, because Cognito can only use its own built-in sender or SES —
it cannot be pointed at Resend.

Cognito's built-in sender (`COGNITO_DEFAULT`) caps at 50 messages per day and
mails from a generic `no-reply@verificationemail.com` address. That ceiling will
not survive launch, so the destination for `gwg-staging-customers` is
`EmailSendingAccount=DEVELOPER` against an SES domain identity.

It is **not** there yet. The pool is deliberately still on `COGNITO_DEFAULT`
while the SES domain identity is unverified, because a pool pointed at an
unverified identity cannot send at all — SES rejects it — and that breaks
sign-up, email-OTP sign-in and password reset for everyone testing against the
environment. A capped sender that works beats a correct one that does not. The
`REPLY-TO` address is set to `info@greatwestgraphics.com` even on the built-in
sender, so replies reach the business rather than the generic AWS address.

`06-create-cognito.sh` also leaves new pools on `COGNITO_DEFAULT`, so any new
environment starts capped at 50/day with default AWS templates.

Both providers authenticate as the same domain, so the DNS zone carries two
independent DKIM setups. They do not overlap and neither is redundant:

| Provider | DKIM record(s) | Envelope / Return-Path |
| --- | --- | --- |
| Resend | one `TXT` at `resend._domainkey` | `send.greatwestgraphics.com`, which needs its own SPF `TXT` and `MX` |
| SES | three `CNAME`s at `<token>._domainkey` | default `*.amazonses.com`; no custom MAIL FROM is configured |

The root `SPF` record belongs to Microsoft 365 and must stay a single record
listing only `spf.protection.outlook.com`. Neither provider needs an include
there, because each authenticates SPF against its own envelope domain and
aligns with DMARC through DKIM. Adding a second `SPF` record at the root, or
pointing SES's MAIL FROM at the `send` subdomain Resend already owns, is how
this gets broken.

### Moving Cognito onto SES

The order matters, and every step gates the next:

1. Add the SES DKIM `CNAME` records to DNS.
2. Wait for the SES identity to report `VerificationStatus: SUCCESS`. Until it
   does, the pool cannot send through SES at all.
3. Request SES production access, from the SES console's **Account dashboard**.
   Do this *after* step 2 — AWS treats a verified identity as a prerequisite and
   denies requests made before one exists.
4. Wait for approval, roughly a 24-hour SLA.
5. Only then switch the pool with the command below.

Switching before production access is granted leaves the account in the SES
sandbox, where **mail is delivered only to verified addresses**. Sign-up would
appear to work and then silently fail for every real customer, which is worse
than the 50/day cap it replaced.

`UpdateUserPool` is a full replacement: every parameter you omit reverts to its
default. Omitting `Policies` drops `SignInPolicy` and silently removes
`EMAIL_OTP` as a first-factor, which breaks passwordless sign-in in a way that
looks like an application bug. So rather than retyping the pool's settings, this
reads the live configuration and patches only `EmailConfiguration`, which means
it cannot drop the sign-in policy or the message templates no matter what they
currently contain:

```sh
aws cognito-idp describe-user-pool \
  --user-pool-id ca-central-1_W2axG4i0X --region ca-central-1 \
  --query UserPool --output json \
| jq '{
    UserPoolId: .Id,
    Policies,
    DeletionProtection,
    LambdaConfig,
    AutoVerifiedAttributes,
    VerificationMessageTemplate,
    UserAttributeUpdateSettings,
    MfaConfiguration,
    AccountRecoverySetting,
    UserPoolTier,
    UserPoolTags,
    AdminCreateUserConfig: (.AdminCreateUserConfig | del(.UnusedAccountValidityDays)),
    EmailConfiguration: {
      EmailSendingAccount: "DEVELOPER",
      SourceArn: "arn:aws:ses:ca-central-1:297208880977:identity/greatwestgraphics.com",
      From: "Great West Graphics <noreply@greatwestgraphics.com>",
      ReplyToEmailAddress: "info@greatwestgraphics.com"
    }
  }' > /tmp/cognito-ses.json

aws cognito-idp update-user-pool \
  --cli-input-json file:///tmp/cognito-ses.json --region ca-central-1
```

`UnusedAccountValidityDays` is dropped because `DescribeUserPool` echoes it from
`PasswordPolicy.TemporaryPasswordValidityDays`; the policy field is the
supported one and sending both is redundant. If the pool later gains Lambda
triggers, SMS settings or device tracking, add those keys to the `jq` filter
before running this, since anything absent from the filter is what gets reset.

Then confirm the switch took and nothing else moved:

```sh
aws cognito-idp describe-user-pool \
  --user-pool-id ca-central-1_W2axG4i0X --region ca-central-1 \
  --query 'UserPool.{Email:EmailConfiguration,SignIn:Policies.SignInPolicy,Mfa:MfaConfiguration,Tier:UserPoolTier}'
```

To go back to the built-in sender, run the same pipeline with
`EmailConfiguration` replaced by
`{EmailSendingAccount: "COGNITO_DEFAULT", ReplyToEmailAddress: "info@greatwestgraphics.com"}`.
Drop `SourceArn` and `From` when you do: with `COGNITO_DEFAULT` a `SourceArn`
is treated as a custom FROM address and needs its own SES sending-authorization
policy, so leaving it in place points the built-in sender back at the identity
you were trying to stop using. `ReplyToEmailAddress` is valid with either
sending account.

No IAM work is needed on either switch. Cognito created the
`AWSServiceRoleForAmazonCognitoIdpEmailService` service-linked role the first
time the pool was pointed at SES, and the identity carries a
`CognitoUserPoolSend` authorization policy scoped to this pool. Both survive the
pool pointing away from SES and neither needs recreating.

### The email-OTP message is still AWS boilerplate

The sign-up verification and invitation templates are branded, and the
verification template covers password reset too, because Cognito routes
password-reset mail through the code template. Email-OTP **sign-in** codes are
not covered: that message comes from `EmailMfaConfiguration`, and Cognito
refuses to accept one while MFA is off, with `InvalidParameterException: can't
turn off MFA and configure an MFA together`.

Branding it therefore requires `MfaConfiguration=OPTIONAL`. That is a change to
the pool's authentication posture rather than a cosmetic one, so it was left
alone: the pool has `EMAIL_OTP` as a *first* factor, which is governed by
`SignInPolicy` and works with MFA off, and turning MFA on to fix an email's
letterhead is the wrong trade to make without deciding the auth behaviour first.
Until that decision is made, customers signing in by one-time code get a
default-styled AWS email.

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
