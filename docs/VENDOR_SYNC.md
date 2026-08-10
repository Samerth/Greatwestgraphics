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
| **Full sync** | First import, or weekly catalog refresh | 1) Import all ACTIVE sellable parts 2) Enrich names/images (capped) 3) Refresh **stock + CUSTOMER price** (Bulk Data preferred) |
| **Inventory** | Daily stock/price update after catalog exists | Bulk Data qty+price (1 call/day), else per-style inventory + pricing SOAP |
| **CSV import** | Offline / EDI file drop | Paste products+skus or inventory CSV |

Storefront shoppers never run sync — they only see products after staff sync + soft-hide controls on Catalog.

### Live API sequence (Full sync)

1. `getProductSellable` (`ACTIVE` or `ALL`) — upsert **all** active parts (style code as name fallback; qty starts at 0)
2. Optional `getProduct` + `getMediaContent` for up to `SANMAR_MAX_PRODUCTS` styles (names/brand/Primary image)
3. Qty + price refresh:
   - Prefer **Bulk Data** (qty + price for all parts; **1 call/day**)
   - Else concurrent `getInventoryLevels` + `getConfigurationAndPricing` (Customer / CAD / Blank) over catalog styles
4. Standalone **Inventory** button runs step 3 only

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
