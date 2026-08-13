# AGENTS.md

## Cursor Cloud specific instructions

This repo is a Node 22 npm-workspace monorepo: a Next.js 15 storefront/portal at the
repository root (port `3000`) plus a Fastify `@gwg/commerce-api` in
`services/commerce-api` (port `4000`), backed by PostgreSQL via Drizzle. Standard
commands live in the root `package.json`, the service `package.json`, and `README.md`;
prefer those over duplicating here.

### Environment already provided (do not redo)

- Node dependencies are refreshed automatically on VM startup by the update script
  (`npm ci`). You normally do not need to run install yourself.
- PostgreSQL 16 is installed in the VM snapshot with a `postgres` role
  (password `postgres`) and a `great_west_graphics` database that already has
  migrations + the dev seed applied. `.env` is created from `.env.example` and is
  gitignored.

### Starting the app (services are NOT auto-started)

1. Ensure PostgreSQL is running (it does not auto-start on a fresh boot):
   `sudo pg_ctlcluster 16 main start` (safe to run; no-op/error if already up).
   Verify with `pg_lsclusters`.
2. Commerce API (terminal 1): `npm run dev:api` — listens on `http://127.0.0.1:4000`.
   Health: `GET /health`, `GET /ready`.
3. Storefront (terminal 2): `npm run dev` — serves `http://localhost:3000`.

### Non-obvious gotchas

- `.env` gotcha (already fixed locally): `.env.example` ships `SANMAR_LOGIN_EMAIL=`
  (empty string), which fails the `.email()` check in
  `services/commerce-api/src/config.ts` and crashes `npm run dev:api` on boot with a
  `ZodError`. The local `.env` leaves that key unset (commented out). If you recreate
  `.env` from the example, comment out or remove `SANMAR_LOGIN_EMAIL=` (empty is not
  allowed; only unset or a real e-mail).
- `npm run db:seed` has no build step and imports `@gwg/pricing/dist`, so build the
  workspace packages first if `node_modules/@gwg/pricing/dist` is missing (e.g. right
  after `npm ci`): `npm run build --workspace @gwg/contracts && npm run build --workspace @gwg/pricing`.
  `npm run dev:api`, `npm test`, `npm run typecheck:all`, and `npm run build:all` build
  these packages automatically via their `pre*` scripts, so this only matters for
  `db:seed`, `db:migrate`, and other direct `db:*` commands.
- Lint is not runnable non-interactively: `npm run lint` (`next lint`) prompts to
  configure ESLint because no ESLint config is committed. CI does not run lint; it uses
  `npm run typecheck:all` as the type gate (see `.github/workflows/ci.yml`). Use
  `npm run typecheck:all` instead of `npm run lint`.
- The storefront catalog is empty unless S&S Activewear credentials
  (`SS_ACCOUNT_NUMBER`/`SS_API_KEY`) are set and a sync is run; the `/quote` builder,
  pricing engine, and cart work fully without them (they use the seeded published
  pricing config and static product tiles).
- Playwright e2e (`npm run test:e2e`) reuses an already-running server on `3000` when
  `CI` is unset; otherwise it starts a production server via `npm run start` (needs a
  prior `npm run build`). Run `npx playwright install chromium` once if the browser is
  missing.

### Known repository bug (blocks the checkout -> job-submission path)

The Drizzle migration journal `services/commerce-api/drizzle/meta/_journal.json` is
missing entries for `0007_add_size_chart_pdf` and `0008_multi_vendor_refactor` (it jumps
from idx 6 straight to `0009_job_display_id`), so `npm run db:migrate` never applies
them. `services/commerce-api/src/db/schema.ts` nonetheless declares the `job_requests`
payment/CRM columns that `0008` would add (`payment_status`,
`stripe_checkout_session_id`, `final_quote_amount_minor`, `paid_at`, `cod_crm_job_id`,
`last_crm_sync_at`). Because the app reads `job_requests` with `select()` (all columns),
any code path touching `job_requests` (customer portal `/portal/jobs`, and the checkout
job create/submit flow) fails with Postgres `42703` "column does not exist". Note also
that `0008` uses different CRM column names (`crm_order_id`, `crm_system`) than
`schema.ts` (`cod_crm_job_id`), so simply re-adding those migrations to the journal is
not sufficient. This is a pre-existing data/migration bug, not an environment problem;
fixing it (regenerating a migration to reconcile `schema.ts`) is a code change outside
environment setup. The storefront/quote/cart/pricing paths are unaffected.
