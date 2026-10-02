# Multi-vendor catalog sync

All blank-goods vendors write into the same `ss_styles` / `ss_products` / `ss_variants` tables, namespaced by a `vendor` column. That lets S&S, Sanmar, and future CSV-only partners coexist without SKU collisions.

## Architecture

```
VendorCatalogAdapter (interface)
  ├─ SsActivewearAdapter     → S&S REST API
  ├─ SanmarSyncService       → EDI/CSV (+ optional PromoStandards SOAP)
  └─ CsvVendorAdapter        → canonical CSV (any vendor key)
           ↓
     CatalogWriter           → shared upsert into ss_* + vendor_mappings
           ↓
     VendorSyncRegistry      → factory used by POST /admin/catalog/sync
```

To add a new vendor:

1. Implement `VendorCatalogAdapter` (or reuse `CsvVendorAdapter` with a custom key).
2. Register it in `VendorSyncRegistry.getAdapter()` / `listVendors()`.
3. Optionally seed a `vendors` row for the tenant.

## S&S Activewear Canada (REST v2)

| Env | Value |
|-----|--------|
| `SS_ACCOUNT_NUMBER` | Account number (Basic auth user) |
| `SS_API_KEY` | API key (Basic auth password) |
| `SS_API_BASE_URL` | Default `https://api-ca.ssactivewear.com` |

Rate limit: ~60 requests/minute (`X-Rate-Limit-Remaining`).

### What staff click in Admin → Catalog sync

| Button | When to use | What it does |
|--------|-------------|--------------|
| **Full sync** | First import, or big catalog refresh | Styles → products/SKUs (qty + `customerPrice` + images) |
| **Update stock & price** | Daily after catalog exists | One Products pull (`skuID_Master,sku,qty,customerPrice,mapPrice`); Inventory API fallback is qty-only |

Inventory responses nest qty under `warehouses[]` — the client sums those when a top-level `qty` is missing. Pricing is not on Inventory; daily refresh uses Products.

CLI:

```bash
npm run sync:ss -w @gwg/commerce-api
npm run sync:ss -w @gwg/commerce-api -- --inventory
```

## SanMar Canada (ATC PromoStandards)

Per `ATC_Pstd_IntegrationGuide_2025`:

| Env | PromoStandards field | Value |
|-----|----------------------|--------|
| `SANMAR_ACCOUNT_ID` | `id` | Customer ID (e.g. `161`) |
| `SANMAR_LOGIN_EMAIL` | `password` | **Login e-mail** (not the website password) |
| `SANMAR_BULK_LOGIN_EMAIL` | Bulk `password` | Optional. Login e-mail used **only** for Bulk Data; unset = `SANMAR_LOGIN_EMAIL`. Bulk worked with the individual login SanMar's own test used and was refused with the shared shop inbox (see below). |
| `SANMAR_MEDIA_PASSWORD` | Media `password` | Separate password from EDI team. **Does not authorize Bulk Data.** Staging/prod only see this if the vendor secret (or `gwg-*/api`) JSON key is injected by `09-create-ecs.sh` / `18-retarget-ecs.sh`. |
| `SANMAR_API_BASE_URL` | host | `https://edi.atc-apparel.com` |

Optional URL overrides (UAT): `SANMAR_INVENTORY_URL`, `SANMAR_PRICING_URL`, `SANMAR_MEDIA_URL`, `SANMAR_BULK_URL`.

Also required by SanMar: static IP whitelist + EDI agreement (`edi@sanmarcanada.com`).

**Bulk Data history (11 Sep – 1 Oct 2026) — what was refused, what worked, what is still unknown.**

- **11 Sep:** a probe got "You are not authorized user for this call" (error
  code **120**) and concluded the account needed a separate entitlement. That
  was wrong, and it had already gone to the client before it was disproven —
  SanMar's own EDI team tested Bulk with GWG's account and it worked.
- **26 Sep:** from AWS CloudShell, SanMar's published sandbox account
  succeeded at the same moment account 161 was refused, same request. So not
  our request shape (checked byte-for-byte against SanMar's working capture)
  and not a blanket address block.
- **30 Sep:** SanMar added the fixed address below to the account. A call
  through it with the shop's general inbox (`Info@…`) was still refused.
- **1 Oct:** a call through the same fixed address with the individual login
  from SanMar's own working test (`harvey@…`) **succeeded**: 20,583 parts,
  693 styles, ~50 MB, ~10 s, ServiceMessage code 200.

**What is proven and what is not.** With the address unchanged, switching the
login flipped refusal to success, so *the login matters*. Whether the
*address* also matters is **not** proven — the address and the login both
changed between the 26 Sep refusal and the 1 Oct success, and the address was
never tried alone with the working login. Two free tests settle it (a refused
call does not use up the day's one call): `Info@…` through the box again (a
120 means login is the lever), and the working login straight from CloudShell
without the box (a 120 means the address is also required). Until then the box
stays. It exists because ECS has no fixed outbound address
(`assignPublicIp: ENABLED`, no NAT — a new one on every deploy) and SanMar's EDI
agreement asks for a static one on file: every SanMar call routes through one
small always-on instance when `SANMAR_VENDOR_PROXY_URL` is set — see
`infra/cloudshell/scripts/26-create-vendor-egress.sh` and the doc comment on
`SanmarClientOptions.vendorProxyUrl` in `adapters/sanmar/client.ts`. Its fixed
address, not whatever a one-off CloudShell session shows, is what is registered
with SanMar.

**Why Bulk is read as a stream.** The reply is ~50 MB of XML. Held as one JS
string that is ~100 MB (two bytes a character — the French text has accents)
on top of the bytes it came from, inside an API task with 512 MB.
`parseBulkProductsFromStream` parses each `<Product>` as it arrives and keeps
only the small row; on the real reply it completes inside a 48 MB heap where
the whole-string parse runs out of memory at 64 MB. Each retained field is
copied out (`detach`) because a V8 substring otherwise pins the whole chunk it
was cut from — without that, 20,583 small rows held 121 MB instead of ~20 MB.

**Facts about the real Bulk reply** (1 Oct 2026): 20,583 parts, 693 styles,
4,134 style-colours. The part id (`17977-1`) is the same format as the sellable
`partId` and is the join key onto `ss_variants.externalKey`. 31 parts carry
price `0.00` (no price, not a free garment — `updateInventory` keeps the price on
file when the feed says 0). 3,702 parts carry a `salePrice`, 5,410 a
`discountCode` (X/S/C/M) and every part `priceGroup` 4; the sync reads none of
those three yet. Image URLs: 4,128 unique, none on-model (289 `_flat_`, 3,839
plain flat-style), 6 style-colours with no image.

### What staff click in Admin → Catalog sync

| Button | When to use | What it does |
|--------|-------------|--------------|
| **Full sync** | First import, or weekly catalog refresh | 1) Import all ACTIVE sellable parts 2) Enrich names + **per-colour photos via Media** (capped at `SANMAR_MAX_PRODUCTS`, default 50 — not the whole catalog) 3) Refresh **stock + CUSTOMER price + Bulk part photos** when Bulk answers |
| **Update stock & price** | Daily stock/price update after catalog exists, or to backfill SanMar colour photos | Bulk Data qty+price+part `<image>` (1 call/day) when Bulk answers. If Bulk returns “not authorized user for this call” (or any other Bulk failure), qty/price still update via per-style SOAP, and colour photos are filled from **Media** for up to `SANMAR_MAX_PRODUCTS` storefront styles (default 50). Putting the media password on the Bulk call will not satisfy Bulk authorization. A Bulk HTTP 500 with `Procedure 'GetBulkDataRequest' not present` is a client xmlns bug, not the daily limit. |
| **CSV import** | Offline / EDI file drop | Paste products+skus or inventory CSV |

Storefront shoppers never run sync — they only see products after staff sync + soft-hide controls on Catalog.

### Live API sequence (Full sync)

1. `getProductSellable` (`ACTIVE` or `ALL`) — upsert **all** active parts (style code as name fallback; qty starts at 0)
2. Optional `getProduct` + `getMediaContent` for up to `SANMAR_MAX_PRODUCTS` styles (default 50). `getMediaContent` uses `SANMAR_ACCOUNT_ID` + `SANMAR_MEDIA_PASSWORD`. Names/brand go on the style; the media bag and each ProductPart `<url>` are matched onto `ss_products.color_front_image_url` (side/back when the filename names the angle). `urls[0]` is only the style-level fallback. This is **not** a whole-catalog Media crawl — raising the cap past a few dozen styles will rate-limit.
3. Qty + price refresh:
   - Prefer **Bulk Data** (qty + price + per-part `<image>` for all parts; **1 call/day**). Bulk uses `SANMAR_ACCOUNT_ID` + login e-mail only — **never** the media password. The request must set `xmlns="https://edi.atc-apparel.com/bulk-data/"` or ATC returns HTTP 500 `Procedure 'GetBulkDataRequest' not present`. Images are written onto the matching colourway — they are no longer dropped.
   - Bulk's photo for each part is written onto the matching colourway. The catalogue was first imported from the sellable feed, which shortens colour names (`Charcoal Hthr`, `Dk Hthr Grey`, `LapisBlueFrst`) while Bulk spells them out (`Charcoal Heather*`, `Dark Heather Grey`, `Lapis Blue Frost`), so an exact-name match left 438 staging colourways with no photo. `alignPatchesToCatalogueColours` (`adapters/sanmar/color-images.ts`) renames a Bulk colour to the catalogue's spelling only when exactly one catalogue colour in that style has the same key (`sanmarColourKey`: case, spacing, punctuation, `*`/`®` and a short list of abbreviations ignored); anything less certain is left alone. Checked against the 1 Oct 2026 reply: 294 more colourways matched, none ambiguous. Two-tone names that are heavily abbreviated (`Char/Navy`, `Flag DpNy/Wh`) and styles Bulk does not list at all (promo items) still get no photo from Bulk.
   - “You are not authorized user for this call” on Bulk (error code **120**) is SanMar refusing this login / calling address for Bulk, not a missing media password and not a missing entitlement (Bulk is enabled for account 161 — it returned the full catalogue on 1 Oct 2026). Treat it as Bulk unavailable (do not abort the run); see “Bulk Data history” above for which login and address to use (`SANMAR_BULK_LOGIN_EMAIL`, `SANMAR_VENDOR_PROXY_URL`).
   - Else concurrent `getInventoryLevels` + `getConfigurationAndPricing` (Customer / CAD / Blank) over catalog styles. That fallback still writes qty/price; `completed_with_errors` is expected when Bulk failed.
4. Standalone **Update stock & price** runs step 3. When Bulk is unavailable and `SANMAR_MEDIA_PASSWORD` is present, it then calls Media for up to `SANMAR_MAX_PRODUCTS` storefront-visible styles so colour photos can land without Bulk. Do not retry Bulk the same day after a **successful** Bulk call. A 500 “procedure not present” does not consume the daily limit.

Sellable `productId` values look like `NF0A529K(TNF Black,S,)` — parsed into style/color/size; trailing `S|M|X|C` means discontinued.

CSV fallback (`SANMAR_CSV_DIR` or Admin paste) still works:

- `products.csv` — `productId,productName,brandName,category,price,imageUrl`
- `skus.csv` — `skuId,productId,sku,colorName,sizeName,quantity,price,imageUrl`
- `inventory.csv` (optional)

CLI:

```bash
npm run sync:sanmar -w @gwg/commerce-api
npm run sync:sanmar -w @gwg/commerce-api -- --inventory
```
## Canonical CSV (any vendor)

Header row required. One row per size SKU:

```text
style_key,brand_name,style_name,title,description,category,color_name,color_code,color_hex,size_name,size_code,size_order,sku_key,sku,gtin,qty,price,map_price,image_front,image_side,image_back,image_swatch
```

Aliases such as `product_id`, `brand`, `color`, `quantity` are accepted.

For a future file-drop partner, set **Custom vendor key** (e.g. `acme_blanks`) so their catalog is isolated under that namespace.

Inventory-only CSV:

```text
sku_key,qty,price
```

## Soft-hide (`storefront_visible`)

Staff can hide a **colorway** (`ss_products`) from the storefront without
marking it discontinued:

| Column | Owner | Sync may overwrite? |
|--------|--------|---------------------|
| `active` | Vendor discontinued / sellable | Yes |
| `storefront_visible` | Staff soft-hide | **Never** |
| `hidden_at` / `hidden_by` | Staff audit | **Never** |

Full sync, inventory sync, CSV import, and single-style refresh all go through
`CatalogWriter` (or the S&S upsert path) and must omit these staff fields from
`ON CONFLICT` / `UPDATE` sets. Hidden products are **omitted** from storefront
PLP, brands, sitemap, and design picker (not shown as Unavailable).

## Admin API

- `GET /admin/catalog/vendors` — configured adapters + capabilities
- `POST /admin/catalog/sync` — `{ vendor, type: full|inventory|csv_import, csvContent?, vendorKey? }`
- `GET /admin/catalog/products` — filters: `search`, `vendor`, `visibility`, `stock`, `categoryId`, `brand`, `sort`, pagination (`limit`/`offset`) → `{ products, total }`
- `PATCH /admin/catalog/products/:id` — `{ storefrontVisible?, active?, isDark?, categoryIds? }`
- `POST /admin/catalog/products/bulk` — `{ productIds, storefrontVisible }`
- `POST /admin/catalog/products/:id/refresh` — single-style refresh (Sanmar + S&S)
