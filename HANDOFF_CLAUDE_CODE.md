# Great West Graphics — Claude Code Handoff

**Repo:** https://github.com/Samerth/Greatwestgraphics  
**Branch:** `main`  
**Date:** 2026-07-29  
**Stack:** Next.js 15 (App Router) storefront + Fastify `commerce-api` + Drizzle/Postgres + `@gwg/pricing` + `@gwg/contracts`

Use this doc to continue work without rediscovering context. Do **not** commit `.env`. Local secrets live only in `.env` (gitignored); templates are in `.env.example`.

---

## What this product is

B2B custom print / embroidery storefront for **Great West Graphics** (Vancouver). Customers browse blanks, build quotes, submit jobs. Staff use `/admin` for catalog (S&S Activewear Canada), pricing config, jobs, categories.

---

## How to run locally

```bash
# Terminal 1 — Postgres must be up (Docker Compose preferred)
docker compose up -d postgres   # if Docker Desktop is healthy

npm run db:migrate
npm run db:seed

# Terminal 2
npm run dev:api                 # http://127.0.0.1:4000

# Terminal 3
npm run dev                     # http://localhost:3000
```

**Staff admin:** http://localhost:3000/admin/login  
- Header/footer now have **Staff** / **Staff login** links  
- Creds from `.env`: `STAFF_ADMIN_USER` / `STAFF_ADMIN_PASSWORD`  
- Session cookie: `gwg_staff_session` (HMAC via `STAFF_SESSION_SECRET`)

**Customer portal (dev):** `/portal/jobs` — uses header-based commerce identity from env.

---

## Required env (see `.env.example`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres |
| `COMMERCE_API_BASE_URL` | Next → API (default `http://127.0.0.1:4000`) |
| `COMMERCE_DEV_*_ID` | Dev tenant/account/store/customer UUIDs (match seed) |
| `ENABLE_DEV_ADMIN_ROUTES=true` | Enables `/admin/*` on commerce-api |
| `DEV_ADMIN_TOKEN` | Next proxies admin calls with `x-dev-admin-token` |
| `STAFF_ADMIN_USER` / `STAFF_ADMIN_PASSWORD` / `STAFF_SESSION_SECRET` | Next staff login |
| `SS_ACCOUNT_NUMBER` / `SS_API_KEY` | S&S Activewear **Canada** only |
| `SS_API_BASE_URL` | Default `https://api-ca.ssactivewear.com` |

Sync: Admin → Sync UI, or `npm run sync:ss` (optional `--inventory`).

---

## Architecture (current)

```
Browser  →  Next.js (:3000)
              ├─ storefront (shop, quote, design, cart, checkout)
              ├─ /admin/* (staff cookie session → calls commerce-api with DEV_ADMIN_TOKEN)
              └─ /portal/jobs (customer job list; pricing redirects to /admin/pricing)

Next     →  commerce-api (:4000)  →  Postgres
                                      ↑
                               SsSyncService ← api-ca.ssactivewear.com
                               images → public/vendor/ss/
```

**Rule:** Storefront never calls S&S from the browser. Catalog reads are local DB only (`/v1/catalog/*`).

### Key packages

- `packages/pricing` (`@gwg/pricing`) — pure `calculateQuote`, garment markup grid, dark premium
- `packages/contracts` (`@gwg/contracts`) — Zod schemas; money in **minor units** (cents)
- `services/commerce-api` — jobs, pricing config publish, S&S sync, catalog admin

### Important paths

| Area | Path |
|------|------|
| Admin UI | `app/admin/*`, `components/admin/AdminShell.tsx` |
| Staff auth | `lib/admin/auth.ts`, `middleware.ts` |
| Commerce client | `lib/commerce/client.ts` |
| Catalog loader | `lib/commerce/catalog.ts` |
| S&S client/sync | `services/commerce-api/src/adapters/ss-activewear/` |
| Catalog service | `services/commerce-api/src/application/catalog-service.ts` |
| Pricing service | `services/commerce-api/src/application/pricing-config-service.ts` |
| Schema | `services/commerce-api/src/db/schema.ts` |
| Migrations | `services/commerce-api/drizzle/0002_*.sql` (pricing), `0003_*.sql` (S&S catalog) |
| Seed categories | Coastal Reign **nav structure only** in `seed.ts` |

---

## Done (shipped on this branch of work)

### Pricing engine
- `@gwg/pricing` with acceptance tests (garment markup from Excel anchors)
- `pricing_configs` table + draft/publish/versions
- QuoteBuilder + storefront use published config (fallback `DEFAULT_PRICING_CONFIG_V1`)
- Admin Pricing UI at `/admin/pricing` (was `/portal/pricing`)

### Admin shell + S&S catalog
- Staff login + middleware guard
- Dashboard, Jobs inbox (+ transitions), Catalog browser, Categories CRUD, Mappings + needs-review, Quotes list, Sync UI, Settings (retail markup)
- Tables: `ss_styles`, `ss_products`, `ss_variants`, `categories`, `ss_category_map`, `category_overrides`, `ss_unmapped_categories`, `sync_runs`, `catalog_settings`
- Retail: `max(mapPrice, cost × retailMarkup)` (default markup **2.0**)
- OOS: shown as **Unavailable**, not hidden
- Phase 2 3D: columns only (`model_*`, `material_config`) — no Meshy/Tripo

### Storefront wiring
- Products/home/quote prefer DB catalog when synced; else static tiles
- `isDark` + `customerPriceMinor` into pricing
- Header **Staff** + footer **Staff login** / **My jobs**
- Fixed dead bestseller/product slugs; quote CTA → `/checkout`; footer `?method=` / `?type=bulk` applied

---

## Pending / known gaps (prioritize)

1. **Postgres / Docker** — often flaky on this machine (Docker Desktop 500s). Migrate/seed/sync need a healthy DB.
2. **Live S&S sync** — needs real `SS_ACCOUNT_NUMBER` + `SS_API_KEY`; empty until set. First full sync is long (rate limit ≤60/min).
3. **Image storage** — local `public/vendor/ss/` only; need S3 port for UAT/AWS.
4. **Contact form** — still client-side “preview”; does not send mail/API.
5. **Category nav** — header/footer still use static shop category query slugs (`apparel`, etc.); DB seed uses Coastal slugs (`t-shirts`, …). Align nav with live categories when DB catalog is primary.
6. **Checkout → job lines** — should persist `ss_product` / variant IDs + pricing snapshot more completely for staff re-price.
7. **Production auth** — staff env login + header identity are **dev-only**. Plan: Cognito/Supabase Auth later; not started.
8. **AWS UAT/prod** — not deployed. Suggested: App Runner/ECS + RDS Postgres + S3; local stays Docker Postgres.
9. **Phase 2 3D** — queue stub only; do not enable paid AI until templates exist.
10. **Next hang** — occasionally port 3000 listens but stops responding; kill listener PID and `npm run dev` again.

### Explicitly out of scope (do not invent)
- US `api.ssactivewear.com`
- Hotlinking S&S images in production
- Full CodCRM replacement
- Live Meshy billing

---

## Verify commands

```bash
npm run typecheck --workspace @gwg/commerce-api
npx tsc --noEmit
npm test --workspace @gwg/pricing
npm test --workspace @gwg/commerce-api
```

Migrations: **only** `npm run db:generate` via drizzle-kit (do not hand-edit journals lightly). Prefer regenerate after schema changes.

---

## Suggested next tasks for Claude Code

1. Confirm Docker/Postgres, run migrate + seed, smoke `/admin` + `/admin/sync` with real S&S keys (or mock fixtures if no keys).
2. Align shop category nav with `categories` table when DB has products.
3. Wire contact form to a real endpoint (or Resend/SES).
4. Extract image store interface → S3 implementation; keep local for dev.
5. Harden checkout job submission with catalog IDs + pricing snapshot fields staff Quotes page expects.
6. Add a thin `/admin` index health that fails clearly when API/DB down (user already shows errors; improve UX).
7. Prep `docker-compose` / deploy notes for AWS UAT (RDS + S3 + App Runner).

---

## Locked product decisions (do not reopen unless asked)

- Vendor: **S&S Canada only**
- Website product = style + color; variant = size
- Staff auth v1: env credentials + HTTP-only cookie (not Supabase Auth yet)
- Retail floor never below MAP
- Discontinued styles → `active=false`, not delete
- Coastal Reign used for **category taxonomy structure only** — never copy their design/copy

---

## Quick URLs

| URL | Role |
|-----|------|
| `/` | Storefront home |
| `/products` | Catalog |
| `/quote` | Quote builder |
| `/admin/login` | Staff sign-in |
| `/admin` | Staff dashboard |
| `/admin/sync` | S&S sync |
| `/admin/pricing` | Pricing draft/publish |
| `/portal/jobs` | Customer jobs (dev identity) |
| `:4000/health` | API health |

---

## Commit context

This handoff accompanies the push that added pricing engine, admin shell, S&S catalog sync, and storefront catalog wiring on `main`. Read recent `git log` for exact message. Continue from **Pending** section above.
