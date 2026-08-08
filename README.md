# Great West Graphics

Minimal npm-workspace monorepo for the public storefront and approval-first
commerce backend.

## Structure

- `/app`, `/components`, `/lib`: existing Next.js storefront, intentionally kept
  at the repository root to preserve its current behavior and avoid a risky move.
- `packages/contracts`: canonical Zod schemas, IDs, statuses, versioned event
  envelopes, and future adapter ports.
- `services/commerce-api`: Fastify API, approval workflow, Drizzle/Postgres
  persistence, and generated migrations.

Commerce owns job submission snapshots, status history, final quote/payment
foundations, production-release policy, and its outbox. CodCRM and CodChat are
separate systems; no shared database writes or network integration is present.

## Setup

```sh
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
```

Database migration commands require `DATABASE_URL`. They are never run as part
of install, build, or application startup. Point `DATABASE_URL` at a local
PostgreSQL 15+ database or a development provider, then run the migration and
idempotent development seed commands above. Local Compose and provider notes:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). ECS/ALB/RDS/S3 cutover steps:
[`docs/AWS_DEPLOYMENT.md`](docs/AWS_DEPLOYMENT.md).

## Commands

```sh
npm run dev             # existing storefront at http://localhost:3000
npm run dev:api         # commerce API (default http://127.0.0.1:4000)
npm run typecheck:all
npm test
npm run build:all
npm run db:generate
npm run db:migrate
npm run db:seed
docker compose up --build # optional local containers; migrate/seed first
```

## Commerce API

- `GET /health`
- `GET /ready`
- `POST /v1/job-requests` (requires `Idempotency-Key`)
- `POST /v1/job-requests/:id/submit` (requires `Idempotency-Key`)
- `GET /v1/job-requests` (tenant/account-scoped customer list)
- `GET /v1/job-requests/:id`
- `POST /internal/dev/job-requests/:id/transition` only when explicitly enabled
  outside production and protected by `X-Dev-Admin-Token`

Until a production identity provider is selected, business endpoints accept
development-only `X-Tenant-Id`, `X-Account-Id`, `X-Store-Id`, and optional
`X-Actor-Id` headers. The same scope is required in command bodies and every
job lookup includes tenant and account. Production business requests fail
closed while authentication is unconfigured.

Job requests move through:

`draft → submitted → under_review → approved → awaiting_payment → payment_pending → paid → ready_for_production`

The state machine also supports proof changes, rejection, and payment failure.
Initial submission never takes payment. Every create/status transaction writes
its versioned integration event to the durable outbox in the same transaction.

## Approval-first storefront and portal

Run `npm run dev:api` and `npm run dev` in separate terminals after migrating
and seeding PostgreSQL.

- Storefront checkout: `http://localhost:3000/checkout`
- Development customer job list: `http://localhost:3000/portal/jobs`
- Job detail/timeline: `http://localhost:3000/portal/jobs/:id`
- Commerce API: `http://127.0.0.1:4000`

Checkout collects contact, fulfillment, notes, and immutable cart snapshots,
then creates and submits a job request through a typed server-side web client.
The cart is cleared only after the API confirms submission. Retrying the same
payload reuses its browser-persisted idempotency key.

The portal and storefront currently use the development scope IDs in `.env`.
This is visibly labeled in the UI and is not production authentication.
Payment remains disabled until approval/final pricing, and the future pay action
is still disabled even for payment-ready jobs because Stripe is not connected.

Set `TEST_DATABASE_URL` to a separate migrated database to run the scoped API
integration test; ordinary tests remain database-isolated and skip it when the
variable is absent.

## Phase 2 limitations

- No CodCRM, CodChat, Stripe, email, or vendor network calls are implemented.
- The outbox is durable, but no dispatcher claims delivery yet.
- No card data is accepted or stored.
- Production identity/customer provisioning is not implemented.
- Final quote, payment obligation, artwork, proof, catalog, and vendor mapping
  tables are foundations only; their external workflows are not active.
