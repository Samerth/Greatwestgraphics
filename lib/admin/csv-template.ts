/**
 * What a catalogue CSV has to look like, written down where the person doing
 * the importing can see it.
 *
 * Every column and alias here is taken from the importer itself
 * (services/commerce-api/src/adapters/catalog/csv-parser.ts) rather than from
 * documentation, and a test reads that file back to check none of it has
 * drifted. A format guide that quietly goes stale is worse than none.
 */

export type CsvColumnSpec = {
  name: string;
  required?: boolean;
  aliases?: string[];
  note: string;
};

/** Only two columns actually decide whether a row imports. */
export const CATALOG_REQUIRED_COLUMNS = ["style_key", "sku_key"] as const;

export const CATALOG_COLUMNS: CsvColumnSpec[] = [
  {
    name: "style_key",
    required: true,
    aliases: ["style", "style_id", "product_id"],
    note: "Groups every colour and size of one garment. Repeat it on each row.",
  },
  {
    name: "sku_key",
    required: true,
    aliases: ["sku_id"],
    note: "Unique per colour + size. Falls back to sku if this column is absent.",
  },
  { name: "sku", note: "The vendor's own code. Defaults to sku_key." },
  {
    name: "brand_name",
    aliases: ["brand"],
    note: "Drives the Brands menu. Defaults to Unknown.",
  },
  {
    name: "style_name",
    aliases: ["name", "product_name"],
    note: "Shown on the product card. Defaults to style_key.",
  },
  {
    name: "color_name",
    aliases: ["color"],
    note: "One product per colour. Defaults to Standard.",
  },
  {
    name: "size_name",
    aliases: ["size"],
    note: "One variant per size. Defaults to OSFA.",
  },
  {
    name: "qty",
    aliases: ["quantity", "stock"],
    note: "Stock on hand. Defaults to 0, which reads as out of stock.",
  },
  {
    name: "price",
    aliases: ["customer_price"],
    note: "Blank garment cost, before decoration.",
  },
  { name: "category", note: "Vendor's own label. Mapped to a GWG category." },
  { name: "color_code", note: "Vendor colour code." },
  { name: "color_hex", note: "Swatch fill, e.g. #1A1A1A." },
  { name: "size_code", note: "Vendor size code." },
  { name: "size_order", note: "Sort position, so XL follows L rather than B." },
  { name: "title", note: "Overrides style_name as the page title." },
  { name: "description", note: "Product copy." },
  { name: "gtin", note: "Barcode." },
  { name: "map_price", aliases: ["mapprice"], note: "Minimum advertised price." },
  {
    name: "image_front",
    aliases: ["image_url"],
    note: "Main photo for this colour.",
  },
  { name: "image_side", note: "Side photo." },
  { name: "image_back", note: "Back photo." },
  { name: "image_swatch", note: "Colour chip image." },
];

export const INVENTORY_COLUMNS: CsvColumnSpec[] = [
  {
    name: "sku_key",
    required: true,
    aliases: ["sku_id", "sku"],
    note: "Must match a SKU already in the catalogue.",
  },
  {
    name: "qty",
    aliases: ["quantity", "stock"],
    note: "New stock figure.",
  },
  { name: "price", note: "Optional. Updates the blank cost." },
];

/** A valid three-row file: one style, two colours, three sizes between them. */
export const CATALOG_EXAMPLE_CSV = `style_key,brand_name,style_name,color_name,size_name,sku_key,sku,qty,price
GWGT100,Great West Graphics,Essential Cotton Tee,Black,S,GWGT100-BLK-S,GWGT100-BLK-S,120,8.50
GWGT100,Great West Graphics,Essential Cotton Tee,Black,M,GWGT100-BLK-M,GWGT100-BLK-M,240,8.50
GWGT100,Great West Graphics,Essential Cotton Tee,White,M,GWGT100-WHT-M,GWGT100-WHT-M,180,8.50`;

export const INVENTORY_EXAMPLE_CSV = `sku_key,qty,price
GWGT100-BLK-S,96,8.75
GWGT100-BLK-M,210,8.75`;

export const SANMAR_PRODUCTS_EXAMPLE_CSV = `productId,productName,brandName,category,price,imageUrl
K500,Silk Touch Polo,Port Authority,Polos,14.98,https://cdn.example.com/k500.jpg`;

export const SANMAR_SKUS_EXAMPLE_CSV = `skuId,productId,sku,colorName,sizeName,quantity,price,imageUrl
K500-BLK-L,K500,K500BLKL,Black,L,340,14.98,https://cdn.example.com/k500-blk.jpg`;

/**
 * The rules that actually catch people out, as opposed to the ones that are
 * obvious from looking at the example.
 */
export const CSV_IMPORT_RULES: string[] = [
  "Column order does not matter — the header row is read by name, not position.",
  "Header names ignore case, spaces and hyphens, so Style Key, style-key and style_key are all the same column.",
  "Columns that are not recognised are ignored rather than causing an error.",
  "A row missing style_key or sku_key is skipped silently, so check the row count reported after the run.",
  "Lines starting with # are treated as comments and skipped.",
  "One row per colour and size. Repeat style_key across all of them — that is what groups them into one product.",
];

/** Repeated in the UI so a paste and a file are described identically. */
export function requiredColumnSummary(columns: CsvColumnSpec[]): string {
  const required = columns.filter((column) => column.required);
  return required.map((column) => column.name).join(" and ");
}
