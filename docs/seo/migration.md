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

Unmapped inventoried URLs (old blog posts, FAQ CPT rows, product-category archives, empty WP templates) **301 to the closest relevant page**. They never dump onto `/`. The explicit map lives in `lib/seo/leftovers.ts`; unknown slugs go through `closestRelevantPath()`.

## Pre-launch crawl control

Indexing is **off** until both are true:

1. `SEO_ALLOW_INDEX=true`
2. `NEXT_PUBLIC_SITE_URL` is the production host (not `localhost` or `staging.*`)

Until then:

- Every page sends `noindex`
- `robots.txt` is `Disallow: /` and omits the sitemap line

Flagged pages stay `noindex` even after launch.

## Launch flip

On the cutover deploy (same change that points DNS at this app):

1. Set `SEO_ALLOW_INDEX=true`
2. Set `NEXT_PUBLIC_SITE_URL=https://www.greatwestgraphics.com` (or the live apex you are launching)
3. Redeploy the web task
4. Submit `https://www.greatwestgraphics.com/sitemap.xml` in Search Console

The sitemap always lists the 154 location URLs plus the 37 general-content URLs (and the live catalogue). It omits retired, flagged, and transactional URLs.

## Where the data lives

- `lib/seo/data/location-pages.json` — 154 records (slug, title, meta, H1, city, extracted sections)
- `lib/seo/thin-copy.ts` — unique replacement copy for the empty/templated city pages
- `lib/seo/content-pages.ts` — 37 + 3 flagged
- `app/(shop)/[...slug]/page.tsx` — first-class URLs for every location/landing/flag slug
- `next.config.ts` `redirects()` — 301 map (status **301**, not 308)

Phone on every page: **604-321-3285**. Showroom: **#105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6**.
