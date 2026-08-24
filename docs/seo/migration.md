# Great West Graphics SEO migration

Same domain (`greatwestgraphics.com`). Old WordPress paths stay live unless this doc says otherwise.

**Cutover operators:** start at [Go-live runbook (AT-CUTOVER)](#go-live-runbook-at-cutover--human-only). Do not set `SEO_ALLOW_INDEX=true` until that list says so.

## Counts

| Bucket | Count | What we do |
| --- | --- | --- |
| Location / service pages | **154** | Exact slug, rebuilt from the live WP title/meta/H1 plus extracted body (or unique city copy when the WP page was an empty template). |
| General content | **37** | Exact slug. Ten of these reuse an existing shop page (`/faqs` → FAQ view, `/shop` → catalogue, `/get-a-quote` → quote builder, …). The rest are short landings. |
| Flagged for client / Codsphere | **3** | `/custom-store-website-builder/`, `/xyz-school/`, `/monthly-specials/` — 200, visible review banner, `noindex`. |
| Retired | **2** | 301 only: `/promotional-products-burnaby-2/` → `/promotional-products-burnaby/`, `/safety-products-2/` → `/safety-products/`. |
| Live “-2” slugs (not duplicates) | **4** | `/promotional-products-richmond-2/`, `/custom-embroidered-toques-surrey-2/`, `/screen-printed-custom-t-shirts-2/`, `/t-shirt-printing-2/`. |
| Transactional | **8** | `/cart/` and `/checkout/` already exist. The other six 301 to `/account`, `/checkout`, or `/products`. |
| Homepage | **1** | `/` stays. |

WordPress used trailing slashes. This app keeps the existing Next.js convention (no trailing slash) and 301s `/path/` → `/path` so neither shape 404s.

## Leftovers

Unmapped inventoried URLs (old blog posts, FAQ CPT rows, product-category archives, empty WP templates) **301 to an explicit leftover destination**. They never dump onto `/`. The map lives in `lib/seo/leftovers.ts` (exact leftovers + a short WordPress-only prefix allowlist). Unknown slugs **404**. `closestRelevantPath()` is only for authoring leftover destinations — it is not wired into the catch-all or middleware.

## Pre-launch crawl control

Indexing is **off** until both are true:

1. `SEO_ALLOW_INDEX=true`
2. `NEXT_PUBLIC_SITE_URL` is the production host (not `localhost` or `staging.*`)

Until then:

- Every page sends `noindex`
- `robots.txt` is `Disallow: /` and omits the sitemap line

Flagged pages stay `noindex` even after launch.

## Analytics (existing GA4 property)

The rebuild reuses **G-0M446YCNS9** (GreatWestGraphics, account 267559730 / property 374646781). Do not create a new GA4 property.

### Why `@next/third-parties/google`

Default `gtag.js` only fires `page_view` on a full document load. App Router `next/link` navigations would go untracked. The official Next.js component (`<GoogleAnalytics gaId="G-0M446YCNS9" />` in `app/layout.tsx`) listens for those client navigations and sends pageviews. Do not add a second manual gtag snippet — that would double-count.

Tel/mailto clicks are captured by `components/analytics/AnalyticsClickTracker.tsx` (document-level delegation from the root layout). Conversion events are sent with `lib/analytics/gtag.ts` (`gtag('event', …)` and a safe `window.gtag` guard).

### Events fired in code

| Event | When |
| --- | --- |
| `page_view` | Every route, including App Router client navigations |
| `ads_conversion_Contact_Us_1` | Successful contact form submit (`ContactForm`) |
| `Shopping_Cart_1` | Add to cart from the catalog PDP, Design Studio, quote builder, or cart “move to cart” |
| `Checkout_1` | Checkout wizard starts with items in the cart |
| `purchase` | Job request submitted successfully (`transaction_id`, `value`, `currency: CAD`) |
| `tel` | Click on `a[href^="tel:"]` |
| `mailto` | Click on `a[href^="mailto:"]` |

There is no separate callback-request form. The quote builder adds a line to the cart (so it fires `Shopping_Cart_1`, then `Checkout_1` / `purchase` in checkout). Card payment later in the portal is not a second `purchase`.

The retired custom `gtag.js` snippet used `phone_click`, `email_click`, and `generate_lead`. Those names are **not** in the code anymore. Tel/mailto clicks now fire `tel` and `mailto` only.

### Mark them as key events (human, in GA4 Admin)

Code cannot flip the “key event” switch. After the first hits land in the property:

1. Open [analytics.google.com](https://analytics.google.com) → the **existing** GWG property (`G-0M446YCNS9`).
2. Admin → Data display → **Events**.
3. Find `tel`, `mailto`, `ads_conversion_Contact_Us_1`, `Shopping_Cart_1`, `Checkout_1`, and `purchase`.
4. Toggle **Mark as key event** on each.
5. Optional: Admin → Data display → **Key events** → confirm they appear. If Google Ads is linked, map those key events to conversions there — still the same property, no new Measurement ID.

Keep Enhanced Measurement “Page changes based on browser history events” on as a backup. The `@next/third-parties` component is what makes App Router pageviews reliable.

## Google Search Console (DNS TXT — human only)

This environment cannot publish a real DNS TXT record. WordPress HTML-tag or file verification **will break at cutover** when the WP theme goes away. Use a DNS TXT so verification survives the platform change.

1. Sign in to [Google Search Console](https://search.google.com/search-console) as the property owner.
2. Add a property if one is not already there:
   - Preferred: **Domain** property `greatwestgraphics.com` (covers apex + `www`).
   - Or **URL prefix** `https://www.greatwestgraphics.com`.
3. Choose **DNS record** verification. Google shows a TXT record. Copy it exactly — do not invent a token. It looks like:
   - **Type:** `TXT`
   - **Host / Name:** `@` on the zone for `greatwestgraphics.com` (some hosts want the bare hostname `greatwestgraphics.com` instead of `@`)
   - **Value:** `google-site-verification=TOKEN_FROM_GSC`
4. Create that TXT record at the DNS host that currently answers for `greatwestgraphics.com`.
5. Wait for propagation (minutes to 48 hours). Click **Verify** in Search Console.
6. If the domain property was already verified via DNS, skip 3–5.

### Sitemap after the robots flip

`app/robots.ts` lists `sitemap.xml` only when `SEO_ALLOW_INDEX=true` and the site URL is not staging/localhost. `/sitemap.xml` can still be fetched by URL before that; **do not submit it in Search Console while robots is `Disallow: /`.**

The sitemap lists the 154 location URLs, the 37 general-content URLs, `/locations`, and the live catalogue. It omits retired, flagged, and transactional URLs.

## Already in code (not a cutover task)

Verify these on the deployed build; do not re-implement them at go-live:

| Item | Where |
| --- | --- |
| Same domain (`greatwestgraphics.com`), exact WP slugs | `lib/seo/inventory.ts`, catch-all `app/(shop)/[...slug]/page.tsx` |
| Trailing-slash 301s (`/path/` → `/path`) | Next.js config + `lib/seo/paths.ts` |
| 301s only for the two retired `-2` URLs plus leftovers/transactional | `lib/seo/redirects.ts` — other `-2` slugs 200 |
| Unknown `/product/*` **404** (never 301 to `/products`) | `lib/seo/protected-paths.ts` + product route |
| Commerce routes unmapped (`/products`, `/product/*`, `/quote`, `/design`, `/cart`, `/checkout`, `/account`, `/admin`) | `PROTECTED_TREE` |
| Location hub + footer links to `/how-to-order` and `/decoration-processes` | `/locations`, `components/layout/Footer.tsx` |
| Phone **604-321-3285** (not 604-331-3285) | `lib/seo/phone.ts` |
| Flagged stubs 200 + `noindex` | `/custom-store-website-builder`, `/xyz-school`, `/monthly-specials` |
| Robots / page `noindex` until `SEO_ALLOW_INDEX=true` on a non-staging host | `lib/seo/indexing.ts`, `app/robots.ts` |
| Single GA4 pageview impl: `@next/third-parties/google` `<GoogleAnalytics gaId="G-0M446YCNS9" />` | `app/layout.tsx` — **no** custom `gtag.js` |
| Conversion events (names below) | `lib/analytics/gtag.ts` + shop surfaces |
| Design Studio body print-area plate, L/C/R, ~32% mark width, Right Chest, default Center Chest | `lib/commerce/studio-placement.ts` — already shipped; not a cutover step |

## Go-live runbook (AT-CUTOVER) — human only

Do **not** flip production indexing from a coding agent. Execute these in order on cutover day.

1. **Search Console DNS TXT.** Sign in to [Google Search Console](https://search.google.com/search-console) as the property owner. Prefer a **Domain** property `greatwestgraphics.com` (covers apex + `www`). Choose **DNS record** verification and copy the TXT Google shows — do **not** invent a token.
   - **Type:** `TXT`
   - **Host / Name:** `@` on the `greatwestgraphics.com` zone (some hosts want the bare hostname)
   - **Value:** `google-site-verification=TOKEN_FROM_GSC` (paste the value GSC gives you)
   - Create the record at the current DNS host. Wait for propagation. Click **Verify**. Skip if the domain property is already DNS-verified.
   - WordPress HTML-tag or file verification **will break** when the WP theme goes away. Use DNS.

2. **Cut WordPress / old-site crawlability.** Same domain — WP and Next must not both be indexable. Before or as DNS points at this app: take the old site offline, or set WP to `noindex` + `Disallow: /` and stop advertising its sitemap. Then point the public hostname at this Next app (existing commerce/ALB/CloudFront flow). This is **not** a domain migration.

3. **Set production env and redeploy the web task.**
   - `SEO_ALLOW_INDEX=true` on the **production** web task only (ECS task definition / console env — `09-create-ecs.sh` does not set this; add it at cutover).
   - `NEXT_PUBLIC_SITE_URL=https://www.greatwestgraphics.com` (or the live apex you are launching). Staging/localhost hosts stay closed even if the flag is true.
   - Leave `SEO_ALLOW_INDEX` unset/false on staging.
   - GA4 ID is **not** env-driven. It is hardcoded `G-0M446YCNS9`. Do not add a second Measurement ID or a second gtag snippet.
   - Existing commerce blockers if they are already missing: `COMMERCE_API_BASE_URL`, `DATABASE_URL`, `STAFF_*`, `CUSTOMER_SESSION_SECRET`, `COGNITO_*`, `AWS_S3_*`, Stripe/Resend as used today. See `docs/AWS_DEPLOYMENT.md`.

4. **Confirm robots before submitting the sitemap.**
   - `https://www.greatwestgraphics.com/robots.txt` allows `/` and lists `Sitemap: https://www.greatwestgraphics.com/sitemap.xml`.
   - A sample public page no longer sends `noindex` (flagged stubs still do).

5. **Submit the sitemap in Search Console — only after step 4.**
   - Search Console → Sitemaps → Add `https://www.greatwestgraphics.com/sitemap.xml`
   - Confirm it is fetched.

6. **Mark key events in GA4 Admin** on property **G-0M446YCNS9** (account 267559730 / property 374646781). Code cannot flip this. After the first hits land: Admin → Data display → **Events** → mark as key event:
   - `ads_conversion_Contact_Us_1`
   - `Shopping_Cart_1`
   - `Checkout_1`
   - `purchase`
   - `tel`
   - `mailto`
   - Do **not** look for `phone_click`, `email_click`, or `generate_lead` — those were on the retired custom snippet and are not fired anymore.
   - Keep Enhanced Measurement “Page changes based on browser history events” on as a backup.

7. **Flagged stubs — still pending client / Codsphere.** `/custom-store-website-builder`, `/xyz-school`, `/monthly-specials` stay 200 + `noindex` until someone decides keep / rewrite / 301 / 410.

8. **Optional:** professional rewrite of remaining thin city copy in `lib/seo/thin-copy.ts`. Unique phone-interpolated copy is already live; this is polish, not a blocker.

## Where the data lives

- `lib/seo/data/location-pages.json` — 154 records (slug, title, meta, H1, city, extracted sections)
- `lib/seo/thin-copy.ts` — unique replacement copy for the empty/templated city pages
- `lib/seo/content-pages.ts` — 37 + 3 flagged
- `app/(shop)/[...slug]/page.tsx` — first-class URLs for every location/landing/flag slug
- `next.config.ts` `redirects()` — 301 map (status **301**, not 308)
- `lib/analytics/gtag.ts` — GA4 event names and safe `gtag('event', …)` helper
- `docs/AWS_DEPLOYMENT.md` — ECS/web env and secrets

Phone on every page: **604-321-3285**. Showroom: **#105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6**.
