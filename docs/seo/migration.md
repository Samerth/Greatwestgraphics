# Great West Graphics SEO migration

Same domain (`greatwestgraphics.com`). Old WordPress paths stay live unless this doc says otherwise.

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
| `Shopping_Cart_1` | Any add-to-cart (`useCartStore.addItem`: PDP, Design Studio, quote builder, move-from-saved) |
| `Checkout_1` | Checkout wizard starts with items in the cart |
| `purchase` | Job request submitted successfully (`transaction_id`, `value`, `currency: CAD`) |
| `tel` | Click on `a[href^="tel:"]` |
| `mailto` | Click on `a[href^="mailto:"]` |

There is no separate callback-request form. The quote builder adds a line to the cart (so it fires `Shopping_Cart_1`, then `Checkout_1` / `purchase` in checkout). Card payment later in the portal is not a second `purchase`.

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

`app/robots.ts` lists `sitemap.xml` only when `SEO_ALLOW_INDEX=true` and the site URL is not staging/localhost. Do **not** submit the sitemap while robots is `Disallow: /`.

After the launch flip below:

1. Search Console → Sitemaps → Add `https://www.greatwestgraphics.com/sitemap.xml`
2. Confirm it is fetched.

## Launch flip

On the cutover deploy (same change that points DNS at this app):

1. Set `SEO_ALLOW_INDEX=true`
2. Set `NEXT_PUBLIC_SITE_URL=https://www.greatwestgraphics.com` (or the live apex you are launching)
3. Redeploy the web task
4. Confirm `https://www.greatwestgraphics.com/robots.txt` allows `/` and lists the sitemap
5. Submit `https://www.greatwestgraphics.com/sitemap.xml` in Search Console
6. Mark `tel`, `mailto`, `ads_conversion_Contact_Us_1`, `Shopping_Cart_1`, `Checkout_1`, and `purchase` as key events in GA4 (if not already)

The sitemap always lists the 154 location URLs plus the 37 general-content URLs (and the live catalogue). It omits retired, flagged, and transactional URLs.

## Where the data lives

- `lib/seo/data/location-pages.json` — 154 records (slug, title, meta, H1, city, extracted sections)
- `lib/seo/thin-copy.ts` — unique replacement copy for the empty/templated city pages
- `lib/seo/content-pages.ts` — 37 + 3 flagged
- `app/(shop)/[...slug]/page.tsx` — first-class URLs for every location/landing/flag slug
- `next.config.ts` `redirects()` — 301 map (status **301**, not 308)

Phone on every page: **604-321-3285**. Showroom: **#105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6**.
