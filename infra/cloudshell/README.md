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
| 1 | `01-create-rds.sh` | VPC, public subnets, IGW, RDS PostgreSQL 16, Secrets Manager master password, USD 250 budget + USD billing alarm |
| 2 | `02-migrate-drizzle.sh` **(preferred)** | Applies this repo’s Drizzle migrations |
| 2 alt | `02-migrate-supabase.sh` | Optional `pg_dump` of a Supabase `public` schema. Skip unless GWG data already lives in Supabase. |
| 3 | `03-verify.sh` | RDS checks (TLS, encryption, no `0.0.0.0/0`) |
| 4 | `04-update-allowed-ip.sh` | Replace the trusted SQL client CIDR |
| 5 | `05-create-s3.sh` | Private versioned uploads bucket |
| 6 | `06-create-cognito.sh` | User pool + confidential app client (`USER_AUTH` / email OTP + password). Leaves the pool on Cognito's built-in sender: 50 messages a day from a generic address, with default AWS templates. Switch it to SES before launch — see [Email deliverability](../../docs/AWS_DEPLOYMENT.md#email-deliverability) |
| 7 | `07-create-ecr.sh` | `gwg-web` + `gwg-commerce-api` repos and a GitHub OIDC deploy role |
| 8 | `08-create-app-secrets.sh` | `gwg-prod/web` and `gwg-prod/api` secrets |
| 9 | `09-create-ecs.sh` | ALB, Fargate services, security groups, task roles |
| 10 | `10-print-outputs.sh` | Non-secret summary |
| 11 | `11-verify-github-oidc.sh` | Nothing. Diagnoses why the ECR workflow cannot assume the deploy role. |
| 12 | `12-trace-oidc-denial.sh` | Nothing. Reads CloudTrail for the request STS actually rejected. |
| 13 | `13-create-https.sh` | ACM certificate, HTTPS listener, HTTP→HTTPS redirect |
| 14 | `14-create-cloudfront.sh` | CloudFront distribution with HTTPS on a `*.cloudfront.net` name |
| 15 | `15-copy-database.sh` | Nothing. Copies catalogue and pricing rows from one environment into another. |
| 16 | `16-create-store.sh` | The tenant, account and store rows this environment serves, plus their ids in its state file |
| 17 | `17-roll-ecs.sh` | Nothing new. Restarts the web and API tasks so they pull the tag already on the task definition |
| 18 | `18-retarget-ecs.sh` | Registers new task defs pointing at an existing ECR SHA and deploys. `CLUSTER=gwg-staging` or `gwg-prod` |
| 20 | `20-refresh-database-url.sh` | Rewrites `$NAME_PREFIX/api` `DATABASE_URL` from the live RDS master-user secret and rolls the API. Fixes Postgres `28P01` after a managed password rotation |
| 21 | `21-set-stripe-secrets.sh` | Writes `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` into the existing api/web JSON secrets and attaches them to the ECS task definitions |

## Running more than one environment

`ENVIRONMENT` in `config.env` names every resource, so switching it to
`staging` and re-running the scripts builds a second, fully separate stack:
its own VPC, database, load balancer and ECS cluster.

State is kept per environment in `.gwg-rds-state/<project>-<environment>.env`.
That matters: a single shared state file would hand the new environment the
existing VPC and database IDs, and the scripts would adopt those resources
instead of creating their own.

The container registry is deliberately *not* environment-scoped. `gwg-web` and
`gwg-commerce-api` are shared so the image tested in staging is the exact image
promoted to production, rather than a rebuild that might differ.

Give each environment its own config file rather than editing `ENVIRONMENT`
back and forth — forgetting to change it back aims the next command at the
wrong stack, and the scripts cannot tell that was unintended. Select one with
`CONFIG_FILE`; every script prints the stack and config it is using.

```bash
cp config.env config.staging.env
sed -i 's/^ENVIRONMENT=.*/ENVIRONMENT=staging/'            config.staging.env
sed -i 's/^RDS_INSTANCE_CLASS=.*/RDS_INSTANCE_CLASS=db.t4g.micro/' config.staging.env

export CONFIG_FILE=config.staging.env
./scripts/00-preflight.sh
./scripts/01-create-rds.sh
./scripts/02-migrate-drizzle.sh   # creates the schema in the new database
./scripts/05-create-s3.sh
./scripts/06-create-cognito.sh
./scripts/07-create-ecr.sh
./scripts/08-create-app-secrets.sh
./scripts/16-create-store.sh      # the store this stack serves; without it, no catalogue
./scripts/09-create-ecs.sh
./scripts/14-create-cloudfront.sh
unset CONFIG_FILE                 # back to production
```

Run `07-create-ecr.sh` for every environment even though the repositories are
shared: it records their URIs in that environment's state, and `09-create-ecs.sh`
reads them from there. It creates nothing new on a second run beyond that
environment's own deploy role.

`config.*.env` is gitignored because it carries a trusted IP range.

CloudFront hands out the site's hostname, so it comes last. Once it prints one,
set `SITE_HOSTNAME` to it and re-run `05-create-s3.sh` and `09-create-ecs.sh` so
the CORS origin and `NEXT_PUBLIC_SITE_URL` stop pointing at localhost. Run
`16-create-store.sh` again afterwards so the store row carries the final
hostname too.

## Which store an environment serves (script 16)

`02-migrate-drizzle.sh` creates the schema and no rows, and `npm run db:seed` is
fixture data that does not belong in a real environment — so a freshly
provisioned stack has no tenant, account or store at all. The storefront does not
fail on that. It falls back to a marketing shell with an empty tenant id and
returns 200 for every page, which is why an environment can sit in this state
indefinitely looking deployed.

```bash
./scripts/16-create-store.sh
./scripts/09-create-ecs.sh   # picks the recorded ids up out of state
```

Script 16 creates the three rows (or adopts the ones already there), registers
the site's hostname on the store as its `custom_domain`, and writes
`COMMERCE_DEFAULT_TENANT_ID` / `_ACCOUNT_ID` / `_STORE_ID` / `_STORE_SLUG` /
`_STORE_NAME` into the environment's state file. `09-create-ecs.sh` reads state,
so the values reach the web task without anyone copying UUIDs by hand, and it
warns when they are missing rather than quietly shipping the brochure.

Those variables pin the store: the storefront serves exactly the one they name
and does not ask the API to resolve the inbound `Host` header at all. The
hostname on the store row is what a deployment serving several stores from one
web tier would resolve against instead, and registering it keeps the two answers
in agreement.

### Optional settings that `09-create-ecs.sh` reads

Everything here is optional and the script provisions without it — but a missing
value removes a capability quietly rather than failing, so an environment that
skips them comes up looking healthy while behaving like a brochure. Set them in
the environment's config, or in its state file for the ARNs.

| Setting | Effect when absent |
| --- | --- |
| `IMAGE_TAG` | Defaults to `latest`, which only moves on a push to `main`. Set it to a commit SHA to run that exact build — this is how a branch is tried on staging before it is merged |
| `CONTACT_TO_EMAIL` | Defaults to `info@greatwestgraphics.com` |
| `EMAIL_SECRET_ARN` | Contact form returns 503 instead of confirming a message it cannot send; proof notifications stay queued in `outbox_events` |
| `STAFF_NOTIFICATION_EMAIL` | Customers approving or rejecting proofs is announced to nobody |
| `NOTIFICATIONS_FROM_EMAIL` | Falls back to `noreply@greatwestgraphics.com`, which delivers only once that domain is verified in Resend — sends fail loudly until it is, rather than reaching nobody quietly |
| `SERVICE_TOKEN_SECRET_ARN` | The commerce API refuses every tenant-scoped request in production, so the catalogue is empty |
| `ADMIN_TOKEN_SECRET_ARN` | Admin API routes are not mounted at all |
| `VENDOR_SECRET_ARN` | No vendor credentials, so catalogue sync has nothing to import |
| `COMMERCE_DEFAULT_TENANT_ID` / `_ACCOUNT_ID` / `_STORE_ID` | The storefront has no store to be and serves a marketing shell with no products. Written into state by `16-create-store.sh` rather than set by hand |
| `COMMERCE_DEFAULT_STORE_SLUG` / `_STORE_NAME` | The pinned store shows the built-in `great-west-graphics` / `Great West Graphics` labels rather than the row's own |
| `COMMERCE_STOREFRONT_BASE_DOMAIN` | The commerce API resolves a host only against a registered `stores.custom_domain`. Only a stack serving several stores off one wildcard domain needs it |
| `SANMAR_API_BASE_URL`, `SS_API_BASE_URL` | Vendor adapters fall back to their built-in defaults |

Each secret ARN that is set is also added to the task execution role. That role
is scoped to an explicit list, and a task referencing a secret missing from the
list fails to start rather than starting degraded — so adding a secret by hand
in the console is not enough on its own.

Each environment carries its own RDS instance, load balancer and Fargate tasks,
so a second one roughly doubles the monthly bill. Lower `RDS_INSTANCE_CLASS`
for non-production stacks.

## Giving a new environment something to show (script 15)

`02-migrate-drizzle.sh` builds the schema but leaves every table empty, so a
fresh stack serves an empty catalogue and cannot demonstrate real pricing.
Script 15 copies the catalogue, category, vendor and pricing rows across:

```bash
./scripts/15-copy-database.sh --from prod --to staging
```

Customer records are deliberately excluded. Names, email addresses, orders,
quotes, payment rows and uploaded artwork stay in production rather than being
duplicated into an environment with weaker access controls to make a test site
look busy. `--include-customer-data` overrides this and should be a considered
decision, not a default.

The target's copied tables are emptied first, and the load runs as one
transaction with foreign keys deferred, so it either lands completely or not at
all. The source is only ever read. The script refuses outright to write into
`prod` or `production`, which is the failure that matters if the two arguments
are ever transposed.

It needs Docker and database reachability, so run it from CloudShell rather
than a workstation.

## HTTPS without a domain (script 14)

An ACM certificate cannot be issued for the ALB's own `*.elb.amazonaws.com`
name, so TLS there needs a domain — and this domain's DNS is managed outside
AWS. CloudFront avoids the problem: every distribution comes with a
`*.cloudfront.net` certificate, so HTTPS works with no DNS records and nothing
to renew.

```bash
./scripts/14-create-cloudfront.sh
```

One distribution covers the whole site because the browser only talks to the
Next.js container; commerce API calls go through `/api/commerce/*` server-side.
The script prints the follow-up commands that repoint `SITE_HOSTNAME` at the
CloudFront name.

CloudFront reaches the ALB over plain HTTP, and the ALB is still reachable
directly. That is acceptable for staging, not for card or credential data.

## HTTPS on your own domain (script 13)

DNS for `greatwestgraphics.com` is hosted at Microsoft and carries both the
current live site and Microsoft 365 mail, so the domain is **not** moved into
Route 53. ACM validates over DNS and an ALB answers to a CNAME, so a subdomain
is delegated by adding records at the existing host and the rest of the zone,
including MX and SPF, is left untouched.

Set the storefront name in `config.env`, then run the script twice — once to get
the records, once more after they resolve:

```bash
SITE_HOSTNAME=staging.greatwestgraphics.com
```

```bash
./scripts/13-create-https.sh   # prints the CNAMEs to add
./scripts/13-create-https.sh   # attaches the listener once ACM has issued
```

It refuses to issue for the apex or `www`. It also refuses to run if
`API_HOSTNAME` is set: the commerce API is served by an internal load balancer
with no public address, and giving it a public name would undo that. The
`CLOSE_LEGACY_API_PORT` flag is likewise gone — port 4000 is closed to the
internet by script 9, in the same run that re-points the web container, so
there is no window where one has happened without the other.

RDS is **publicly addressable but not open**. Port 5432 is limited to
`PUBLIC_DB_ALLOWED_CIDR` plus the commerce-api security group after step 9.
Never use `0.0.0.0/0`.

This first ECS pass is **HTTP on the ALB DNS name** (port 80 → web) so you can
smoke-test without a domain. The API is not on that balancer: it answers only
inside the VPC. Add ACM + Route 53 before a public launch. There is no NAT
gateway (Fargate tasks use `assignPublicIp=ENABLED`) to keep the USD 250 budget
realistic.

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
3. Run **Actions → AWS ECR → Run workflow**. Any branch works: the job declares
   the `aws` environment, and the deploy role trusts that subject as well as
   `main`. Only `main` moves the `latest` tag, so a branch build publishes its
   commit SHA alone — deploy it by passing that SHA as `IMAGE_TAG`.
4. Re-run `./scripts/09-create-ecs.sh` so desired count becomes 1
5. Later deploys: a push to `main` builds the commit SHA and `:latest`, then
   retargets `gwg-staging` to that SHA. Production is never rolled from that
   workflow. Promote with **Actions → Promote to production**, or
   `CLUSTER=gwg-prod IMAGE_TAG=<sha> ./scripts/18-retarget-ecs.sh`. Re-run
   `./scripts/07-create-ecr.sh` once so the OIDC role can
   `RegisterTaskDefinition` / `UpdateService`.

Use the workflow's OIDC role, not an access key. CloudShell credentials are
temporary: they expire and need a session token, so pasting them into
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` fails with "The security token
included in the request is invalid".

If the workflow reports `Not authorized to perform sts:AssumeRoleWithWebIdentity`,
AWS gives that same message for a missing provider, a missing role and a
mismatched trust policy. Run this to find out which:

```bash
./scripts/11-verify-github-oidc.sh
```

If that reports all checks passed and the workflow still fails, the role we
inspected is not the one GitHub asked for. CloudTrail records the rejected
request, including the role ARN it named:

```bash
./scripts/12-trace-oidc-denial.sh
```

## Smoke checklist

```bash
curl -fsS "$SITE_URL/api/health"
```

The commerce API sits behind an internal load balancer and has no public
address, so `$API_URL/health` and `$API_URL/ready` only answer from inside the
VPC. The storefront health check above exercises the API behind it, which is
the check that matters; reach for an ECS exec session on a web task when you
genuinely need the API's own endpoints.

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
