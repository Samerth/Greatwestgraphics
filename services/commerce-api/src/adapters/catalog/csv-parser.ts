import type { CatalogSkuRow, InventoryRow } from "./types.js";

/**
 * Canonical GWG vendor CSV (header row required).
 *
 * Columns (aliases in parentheses):
 * - style_key (styleKey, product_id, style)
 * - brand_name (brand)
 * - style_name (name, product_name)
 * - title, description, category
 * - color_name (color), color_code, color_hex
 * - size_name (size), size_code, size_order
 * - sku_key (sku_id, skuId) — opaque id; defaults to sku if omitted
 * - sku
 * - gtin, qty, price, map_price
 * - image_front, image_side, image_back, image_swatch
 *
 * Inventory-only CSV:
 * - sku_key or sku, qty, optional price
 */

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[\s-]+/g, "_");
}

const ALIASES: Record<string, string> = {
  stylekey: "style_key",
  style_id: "style_key",
  product_id: "style_key",
  productid: "style_key",
  style: "style_key",
  brand: "brand_name",
  brandname: "brand_name",
  name: "style_name",
  product_name: "style_name",
  productname: "style_name",
  stylename: "style_name",
  color: "color_name",
  colorname: "color_name",
  colorcode: "color_code",
  colorhex: "color_hex",
  size: "size_name",
  sizename: "size_name",
  sizecode: "size_code",
  sizeorder: "size_order",
  sku_id: "sku_key",
  skuid: "sku_key",
  skukey: "sku_key",
  mapprice: "map_price",
  customer_price: "price",
  imagefront: "image_front",
  image_url: "image_front",
  imageurl: "image_front",
  imageside: "image_side",
  imageback: "image_back",
  imageswatch: "image_swatch",
  quantity: "qty",
  stock: "qty",
};

function canonicalField(raw: string): string {
  const n = normalizeHeader(raw);
  return ALIASES[n.replace(/_/g, "")] ?? ALIASES[n] ?? n;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function parseIntSafe(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseCatalogCsv(csvContent: string): CatalogSkuRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]!).map(canonicalField);
  const rows: CatalogSkuRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? cells[idx] ?? "" : "";
    };

    const styleKey = get("style_key");
    const sku = get("sku");
    const skuKey = get("sku_key") || sku;
    if (!styleKey || !skuKey) continue;

    rows.push({
      styleKey,
      brandName: get("brand_name") || "Unknown",
      styleName: get("style_name") || styleKey,
      title: get("title") || null,
      description: get("description") || null,
      category: get("category") || null,
      colorName: get("color_name") || "Standard",
      colorCode: get("color_code") || null,
      colorHex: get("color_hex") || null,
      sizeName: get("size_name") || "OSFA",
      sizeCode: get("size_code") || null,
      sizeOrder: parseIntSafe(get("size_order")),
      skuKey,
      sku: sku || skuKey,
      gtin: get("gtin") || null,
      qty: parseIntSafe(get("qty")) ?? 0,
      priceDollars: parseNumber(get("price")),
      mapPriceDollars: parseNumber(get("map_price")),
      imageFront: get("image_front") || null,
      imageSide: get("image_side") || null,
      imageBack: get("image_back") || null,
      imageSwatch: get("image_swatch") || null,
    });
  }

  return rows;
}

export function parseInventoryCsv(csvContent: string): InventoryRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]!).map(canonicalField);
  const rows: InventoryRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? cells[idx] ?? "" : "";
    };
    const skuKey = get("sku_key") || undefined;
    const sku = get("sku") || undefined;
    if (!skuKey && !sku) continue;
    rows.push({
      skuKey,
      sku,
      qty: parseIntSafe(get("qty")) ?? 0,
      priceDollars: parseNumber(get("price")),
    });
  }

  return rows;
}

/**
 * Sanmar EDI two-file format:
 * products: productId,productName,brandName,category,price,imageUrl...
 * skus: skuId,productId,sku,colorName,sizeName,quantity,price,imageUrl
 */
export function parseSanmarEdiPair(
  productsCsv: string,
  skusCsv: string,
): CatalogSkuRow[] {
  const products = new Map<
    string,
    {
      productName: string;
      brandName: string;
      category?: string;
      basePrice?: number;
      imageUrl?: string;
    }
  >();

  for (const line of productsCsv.split(/\r?\n/).filter((l) => l.trim())) {
    if (/^productid/i.test(line)) continue;
    const [productId, productName, brandName, category, basePrice, imageUrl] =
      splitCsvLine(line);
    if (!productId || !productName) continue;
    products.set(productId, {
      productName,
      brandName: brandName || "Sanmar",
      category: category || undefined,
      basePrice: parseNumber(basePrice),
      imageUrl: imageUrl || undefined,
    });
  }

  const rows: CatalogSkuRow[] = [];
  for (const line of skusCsv.split(/\r?\n/).filter((l) => l.trim())) {
    if (/^skuid/i.test(line)) continue;
    const [skuId, productId, sku, colorName, sizeName, quantity, price, imageUrl] =
      splitCsvLine(line);
    if (!skuId || !productId) continue;
    const product = products.get(productId);
    rows.push({
      styleKey: productId,
      brandName: product?.brandName || "Sanmar",
      styleName: product?.productName || productId,
      category: product?.category ?? null,
      colorName: colorName || "Standard",
      sizeName: sizeName || "OSFA",
      skuKey: skuId,
      sku: sku || skuId,
      qty: parseIntSafe(quantity) ?? 0,
      priceDollars: parseNumber(price) ?? product?.basePrice,
      imageFront: imageUrl || product?.imageUrl || null,
    });
  }
  return rows;
}
