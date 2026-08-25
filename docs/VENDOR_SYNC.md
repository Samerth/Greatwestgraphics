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
| `SANMAR_MEDIA_PASSWORD` | Media `password` | Separate password from EDI team |
| `SANMAR_API_BASE_URL` | host | `https://edi.atc-apparel.com` |

Optional URL overrides (UAT): `SANMAR_INVENTORY_URL`, `SANMAR_PRICING_URL`, `SANMAR_MEDIA_URL`, `SANMAR_BULK_URL`.

Also required by SanMar: static IP whitelist + EDI agreement (`edi@sanmarcanada.com`).

### What staff click in Admin → Catalog sync

| Button | When to use | What it does |
|--------|-------------|--------------|
| **Full sync** | First import, or weekly catalog refresh | 1) Import all ACTIVE sellable parts 2) Enrich names + **per-colour photos** (capped) 3) Refresh **stock + CUSTOMER price + Bulk part photos** |
| **Update stock & price** | Daily stock/price update after catalog exists, or to backfill SanMar colour photos | Bulk Data qty+price+part `<image>` (1 call/day), else per-style inventory + pricing SOAP (no photos). A Bulk HTTP 500 with `Procedure 'GetBulkDataRequest' not present` is a client xmlns bug, not the daily limit — qty/price still updates via the fallback. |
| **CSV import** | Offline / EDI file drop | Paste products+skus or inventory CSV |

Storefront shoppers never run sync — they only see products after staff sync + soft-hide controls on Catalog.

### Live API sequence (Full sync)

1. `getProductSellable` (`ACTIVE` or `ALL`) — upsert **all** active parts (style code as name fallback; qty starts at 0)
2. Optional `getProduct` + `getMediaContent` for up to `SANMAR_MAX_PRODUCTS` styles (default 50). Names/brand go on the style; the media bag and each ProductPart `<url>` are matched onto `ss_products.color_front_image_url` (side/back when the filename names the angle). `urls[0]` is only the style-level fallback.
3. Qty + price refresh:
   - Prefer **Bulk Data** (qty + price + per-part `<image>` for all parts; **1 call/day**). The request must set `xmlns="https://edi.atc-apparel.com/bulk-data/"` or ATC returns HTTP 500 `Procedure 'GetBulkDataRequest' not present`. Images are written onto the matching colourway — they are no longer dropped.
   - Else concurrent `getInventoryLevels` + `getConfigurationAndPricing` (Customer / CAD / Blank) over catalog styles (no photos). That fallback still writes qty/price; `completed_with_errors` is expected when Bulk failed.
4. Standalone **Update stock & price** runs step 3 only. After a code deploy, that Bulk path is enough to backfill existing SanMar colour photos. Existing rows are not rewritten until a sync runs. Do not retry Bulk the same day after a **successful** Bulk call. A 500 “procedure not present” does not consume the daily limit.

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
