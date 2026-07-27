# Developer handoff

## Current system

This repository is an npm-workspace monorepo:

- `app`, `components`, `lib`: Next.js 15 storefront, design studio, cart,
  approval-first checkout, server-side commerce client, and development customer
  portal.
- `packages/contracts`: shared Zod command/response/event contracts, status
  values, commerce headers, and adapter port interfaces.
- `services/commerce-api`: Fastify API, Drizzle/PostgreSQL schema and migrations,
  development seed, job-request state machine, idempotent commands, scoped
  reads, immutable snapshots/history, and transactional outbox.

Implemented public routes include `/`, `/products`, `/product/:slug`, `/design`,
`/cart`, `/checkout`, `/quote`, `/shipping`, and `/contact`. The approval-first
flow creates a draft from cart/contact/fulfillment snapshots and immediately
submits it for review; it does not collect payment. The cart clears only after
the API confirms submission, and a browser-persisted idempotency key makes
retries safe.

Development portal routes are `/portal/jobs` and `/portal/jobs/:id`. They show
account-scoped requests, immutable submitted lines, status history, and the next
action. Payment remains disabled even for approved/payment-ready work because
Stripe and final-quote workflows are not connected.

## Local setup

Prerequisites: Node.js 22, npm, and PostgreSQL 15+ (the included Compose service
uses PostgreSQL 16).

```sh
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

Run the API and web app in separate terminals:

```sh
npm run dev:api  # http://127.0.0.1:4000
npm run dev:web  # http://localhost:3000
```

The default `.env.example` points host-run commands at the Compose database and
contains the non-secret development IDs inserted by `npm run db:seed`. For Neon,
replace only `DATABASE_URL` in the ignored `.env` with a pooled, TLS-enabled
development connection string, then migrate and seed. Migrations are explicit;
install, build, and application startup never run them.

An all-container alternative is documented in
[`docs/DEPLOYMENT.md`](DEPLOYMENT.md). Useful runtime checks are
`GET http://127.0.0.1:4000/health` and `/ready`.

## Validation

```sh
npm run typecheck:all
npm test
npm run build:all
git diff --check
```

Set `TEST_DATABASE_URL` to a separate, migrated, disposable database to enable
the API integration test; without it, that test is intentionally skipped.

## Ownership and integration boundaries

Commerce is the source of truth for job submission snapshots, customer-visible
status, final quote/payment obligations, payment state, production-release
policy, and its transactional outbox. CodCRM remains a separate system and
should own staff review plus manufacturing/fulfillment operations after
handoff. CodCRM reports mapped status changes back through versioned,
idempotent APIs/events; it must not write the commerce database.

CodChat is a lead/conversation channel, not the order or payment authority. It
should resolve people/accounts through explicit external-identity mappings and
call supported CodCRM/commerce interfaces. No shared-database writes are
allowed between these systems.

No CodCRM or CodChat network adapter is implemented. The shared contracts only
define initial ports and versioned commerce events. The detailed hybrid
workflow is in the local Cursor artifact
`/Users/sam/.cursor/projects/Users-sam-Greatwestgraphics/canvases/backend-architecture.canvas.tsx`.

## Prioritized milestones

1. **Database/runtime smoke test.** Migrate and seed a clean local or Neon
   database; start both apps; verify `/ready`; submit checkout twice with one
   idempotency key; confirm one scoped job, its timeline/snapshots, and pending
   outbox events appear in the portal/database.
2. **Production auth and tenant provisioning.** Select OIDC/Cognito, implement
   web sessions and API JWT verification, map subject/roles to tenant, account,
   store, and person, and add provisioning/revocation. Acceptance: production
   accepts no development identity headers, cross-account reads fail, and
   provisioning plus role tests pass.
3. **Artwork storage.** Add private versioned S3-compatible upload/download
   flows, checksums, metadata, limits, malware/content validation, retention,
   and narrowly scoped presigned URLs. Acceptance: each submitted version is
   immutable, tenant-scoped, auditable, and inaccessible after URL expiry.
4. **Outbox dispatcher and email.** Build claim/lease, retry/backoff,
   dead-letter/alerting, and reconciliation for outbox events; send templated
   submission/status/payment-ready email. Acceptance: concurrent workers
   deliver each event idempotently, failures retry safely, and delivery state is
   observable.
5. **CodCRM adapter.** Agree event/API mappings, send submitted jobs to CodCRM,
   ingest signed status callbacks through the inbox, and add replay plus
   reconciliation. Acceptance: duplicate/out-of-order messages are harmless,
   ownership boundaries hold, and the portal converges to the mapped CRM state.
6. **Stripe.** Create a server-side Checkout Session only from an accepted final
   quote, persist the payment obligation/session, and process signed webhooks
   idempotently. Acceptance: client input cannot set the amount, duplicate
   callbacks cannot double-release production, and only paid jobs reach
   `ready_for_production`.
7. **Vendor sync and pricing.** Implement per-vendor catalog/SKU mapping,
   cursor-based sync, availability, discounts, price provenance, and stale-data
   handling. Acceptance: reruns are idempotent, overrides are auditable, and
   quoted prices retain their source/version.
8. **Web Stores.** Add tenant/account/store administration, branded catalog
   visibility, customer-specific pricing/policies, and scoped storefront
   sessions. Acceptance: two stores can expose different products/prices
   without data leakage and submitted jobs retain the originating policy
   snapshot.
9. **AWS deployment.** Provision reviewed environments, private production
   PostgreSQL, API hosting, web hosting, S3, SES, DNS/TLS, secrets, logs, alarms,
   backups, and a controlled migration job. Acceptance: staging smoke tests,
   restore test, monitoring, rollback, and production go-live checklist pass.

## Required credentials and contracts

Store secret values only in ignored `.env` files for local work and in the
selected cloud secret manager for deployments; never commit or paste them into
docs, tickets, or chat.

- Database: development and test PostgreSQL URLs; production database,
  networking, TLS, backup, migration, and rotation decisions.
- Identity: issuer/JWKS, client ID (and server-client secret if applicable),
  callback/logout URLs, claims/roles, MFA/session/CSRF, tenant provisioning, and
  revocation contracts.
- Artwork: bucket/region, encryption, object prefixes, CORS, MIME/size limits,
  presigned URL lifetime, retention, and deletion policy.
- Email/outbox: provider/SES region and credential role, verified From/Reply-To,
  DKIM, templates, event routing, retry/dead-letter rules, and bounce/complaint
  handling.
- CodCRM/CodChat: environment URLs, API version/docs, OAuth or service
  credentials, scopes, tenant identity, entity/status mappings, idempotency,
  webhook signing/replay rules, sandbox access, and reconciliation ownership.
- Stripe: account/environment, publishable and restricted server keys, webhook
  signing secret, currency/tax/shipping/refund/capture policy, final-amount
  authority, and idempotency rules.
- Vendors: sandbox/production URLs, API versions, credential type, account IDs,
  rate limits, SKU/catalog/pricing/order/proof mappings, webhook verification,
  allowed networks/mTLS, and support contacts.
- Web Stores/AWS: branding/catalog/pricing policy owners; AWS account, region,
  billing budget, OIDC deployment role, DNS, certificates, network/security
  groups, runtime sizing, secret paths, observability, retention, and incident
  contacts.

## Known limitations

Production auth/provisioning, artwork upload, final-quote operations, outbox
dispatch, email, CodCRM/CodChat adapters, Stripe, vendor synchronization, and
Web Store administration are not implemented. Development identity is
deliberately rejected in production. The optional integration test needs a
separate migrated database, and cloud/container runtime smoke tests have not
been performed. Deployment choices, provider prerequisites, and cost caveats
are maintained in [`docs/DEPLOYMENT.md`](DEPLOYMENT.md).
