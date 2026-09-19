# Cod Chat (CodCRM) — GWG status + estimate contract

Short map of what we actually work with. Cod Chat is a conversation layer, not
the order or payment authority. It deep-links Design Studio / product pages and
calls the commerce estimate endpoint. It must not invent artwork, Pantone, or
prices.

Checked against staging on 13 Sep 2026 and `origin/main`.

## Surfaces

| Layer | Where | What we use |
|---|---|---|
| Cod Chat / CodCRM | [codcrm.com](https://www.codcrm.com) (Replit, not AWS/Vercel) | Widget, inbox, Q&A, connectors |
| Widget loader | `https://www.codcrm.com/chat/widget.js` | HTTP 200 |
| GWG staging storefront | `https://d1so4a0f4v7ki5.cloudfront.net` | Embed on the **main** shop only |
| Public widget key | `cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_` | In `components/shared/CodChatWidget.tsx`. Origin allowlist + embed token protect it. Bare `/api/chat/.../config` 404 without Origin is normal. |
| Design Studio | `/design` (staging HTTP 200) | Shopper artwork. Deep-link here. |
| Commerce API | `https://dlpyhz7sgcy8q.cloudfront.net` → ALB :4000 | Money + catalog. `/health` and `/ready` are 200. |
| Service auth | Bearer `gwg-staging/service-token` | Required on pricing/catalog. Missing token → `INVALID_SERVICE_TOKEN`. |

The widget is **not** shown on branded team stores (`!isBranded` in the shop layout).

There is no global CodCRM `COMMERCE_*` env for GWG. The Studio **data connector** holds `baseUrl` + Bearer + headers.

## Product bar (locked)

- Price ask → real `$` from `POST /pricing/quote`, or an honest handoff.
- Always offer a real link: Design Studio (`/design`) or the product “build estimate” UI. Never `/quote` as the public calculator — `SHOW_PUBLIC_QUOTE_CALCULATOR` is **false**.
- Tool / link ask → real URL. Never a Pantone dump. Never invent artwork.

## CodCRM APIs (Studio / Replit)

All under `https://www.codcrm.com`. Need Origin + embed token where noted.

| Path | Role |
|---|---|
| `/api/chat/widgets…` | CRUD / draft / publish |
| `/api/chat/qa…` | Knowledge Q&A (turnaround + returns seeded on Neon) |
| `/api/chat/quick-replies…`, `/api/chat/intents…` | Shortcuts |
| `/api/chat/knowledge/…` | Crawl / sources / suggestions |
| `/api/chat/data-connectors…` | Outbound tools — **GWG estimate lives here** |
| `/api/chat/conversations…` | Inbox |

LLM is OpenRouter / OpenAI via CodCRM Replit secrets. This repo cannot read those values.

## GWG graphics / commerce (this repo)

| Path | Role for Cod Chat |
|---|---|
| `GET/POST /v1/design-projects`, `GET/PUT/DELETE /v1/design-projects/:id` | Saved Studio projects. Chat should deep-link, not draw. |
| `GET/PUT /admin/design-projects…` | Staff only |
| `GET /v1/catalog/products`, `/brands`, `/categories`, `/products/:id` | SanMar + S&S catalog already in the DB |
| `GET /pricing/v2/published` | Published PricingConfig v2 (service token) |
| `GET /pricing-config/published` | Legacy published config |
| `POST /pricing/quote` | **Estimate connector target** (see below) |
| `POST /admin/pricing/v2/preview` | Staff calculator — not the chat path |
| `/v1/job-requests…`, Stripe checkout / webhook | Real jobs and pay. Not the chat ballpark. |

## Other systems

| System | Role |
|---|---|
| Neon / CodCRM DB | Widgets, QA, connectors |
| SanMar PromoStandards | Catalog + photos into commerce. Media password is set. Bulk is a separate SanMar entitlement (often unauthorized). |
| S&S Activewear | Catalog via `SS_ACCOUNT_NUMBER` + `SS_API_KEY` |
| Resend | Storefront `/contact` only — not Cod Chat |
| Stripe | Checkout after a real job, not chat estimates |
| Ascendis / “Ascendance” | **No adapter, no secrets.** Vendors are S&S + SanMar Canada. |

## In flight / blocked

- Estimate `$` in chat: connector + `POST /pricing/quote` exist on staging (POST without Bearer → `INVALID_SERVICE_TOKEN`, not 404). In-widget “polo estimate” still flaky (retrieval / tool invoke). CodCRM Dev owns that; GWG A/B/C dig paused.
- Design Studio deep links: product bar must return a real `/design` or product-estimate URL.
- CodCRM Studio trial UI may show `TRIAL_EXPIRED`; APIs can still work.

---

## Estimate connector contract

This is the only money path Cod Chat should call.

**Endpoint:** `POST https://dlpyhz7sgcy8q.cloudfront.net/pricing/quote`

**Auth**

```
Authorization: Bearer <gwg-staging/service-token>
Content-Type: application/json
```

Optional tenant headers (`x-tenant-id`, `x-account-id`, `x-store-id`, `x-actor-id`). If they are omitted, the API uses `STOREFRONT_DEFAULT_*` or the staging GWG fallback UUIDs. Do not send an admin token.

**Request** (`StorefrontQuoteRequest`)

| Field | Required | Notes |
|---|---|---|
| `qty` | yes | Pieces, integer &gt; 0 |
| `product_id` | one of these | UUID of a catalog product — used to look up garment cost |
| `garment_cost_minor` | one of these | Vendor cost in cents if no product id |
| `sku` | no | Label only |
| `decorations` | no | Max 20. Each: `method`, `location` (default `front`), `colours`, `stitch_count`, `option_key`, `is_oversized` |
| `rush` | no | Default false |

Need either `product_id` (with a priced variant) or `garment_cost_minor`, or the API returns `400 MISSING_GARMENT_COST`.

**Response** (`StorefrontQuoteResponse`) — dollars, not cents

```json
{
  "unit_price": 12.5,
  "total": 150,
  "turnaround_days": 10,
  "currency": "CAD",
  "breakdown": {
    "garment_per_piece": 8,
    "decoration_per_piece": 4.5,
    "setup_total": 35,
    "rush_total": 0
  }
}
```

`turnaround_days` is currently hardcoded to **10** on the API.

**Studio connector shape** (saved on the CodCRM widget, not in GWG env)

- `baseUrl`: `https://dlpyhz7sgcy8q.cloudfront.net`
- `Authorization`: Bearer service token
- Method / path: `POST /pricing/quote`

**Chat behaviour**

1. If the tool returns a total → say the dollar amount in CAD and link Design Studio or the product page.
2. If the tool fails or the ask is too vague → say so and hand off. Do not guess a price.
3. This is a ballpark. It is not a job, not a final quote, and not Stripe.

Schema source: `packages/contracts/src/pricing-v2.ts` (`StorefrontQuoteRequestSchema` / `StorefrontQuoteResponseSchema`). Handler: `POST /pricing/quote` in `services/commerce-api/src/app.ts`.
