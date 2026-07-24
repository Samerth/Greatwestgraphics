export type Category =
  | "Apparel"
  | "Bags"
  | "Headwear"
  | "Outerwear"
  | "Polos"
  | "Promo"
  | "Safety"
  | "Signs";

export interface CatalogTile {
  slug: string;
  name: string;
  sub?: string;
  tags: { label: string; primary?: boolean }[];
  priceFrom: string;
  category: Category;
  artIndex: number;
  size: "hero" | "tall" | "wide" | "sq";
}

// TODO: replace with a query against the synced `products` table
// (grouped by style) once the SanMar BulkData sync is live.
export const CATALOG: CatalogTile[] = [
  {
    slug: "premium-custom-tshirts",
    name: "Premium Custom T-Shirts",
    sub: "250+ styles · Bella+Canvas, Gildan, Next Level",
    tags: [{ label: "Bestseller", primary: true }, { label: "Screen · DTG" }],
    priceFrom: "from $9.20/pc",
    category: "Apparel",
    artIndex: 1,
    size: "hero",
  },
  {
    slug: "hoodies-crewnecks",
    name: "Hoodies & Crewnecks",
    sub: "120+ heavyweight & mid-weight styles",
    tags: [{ label: "Screen · Embroidery" }],
    priceFrom: "from $24.99",
    category: "Apparel",
    artIndex: 2,
    size: "tall",
  },
  {
    slug: "caps-beanies",
    name: "Caps & Beanies",
    tags: [{ label: "3D Embroidery" }],
    priceFrom: "from $11.50",
    category: "Headwear",
    artIndex: 3,
    size: "sq",
  },
  {
    slug: "bags-totes",
    name: "Bags & Totes",
    tags: [{ label: "Screen · Transfer" }],
    priceFrom: "from $6.75",
    category: "Bags",
    artIndex: 4,
    size: "sq",
  },
  {
    slug: "safety-hi-vis",
    name: "Safety & Hi-Vis",
    tags: [{ label: "CSA", primary: true }, { label: "Reflective" }],
    priceFrom: "from $13.25",
    category: "Safety",
    artIndex: 5,
    size: "sq",
  },
  {
    slug: "corporate-polos",
    name: "Corporate Polos",
    tags: [{ label: "Piqué · Perf." }],
    priceFrom: "from $16.40",
    category: "Polos",
    artIndex: 6,
    size: "sq",
  },
  {
    slug: "jackets-outerwear",
    name: "Jackets & Outerwear",
    tags: [{ label: "Softshell" }],
    priceFrom: "from $42.00",
    category: "Outerwear",
    artIndex: 7,
    size: "sq",
  },
  {
    slug: "drinkware-mugs",
    name: "Drinkware & Mugs",
    tags: [{ label: "Full colour" }],
    priceFrom: "from $3.20",
    category: "Promo",
    artIndex: 8,
    size: "sq",
  },
  {
    slug: "stickers-decals",
    name: "Stickers & Decals",
    tags: [{ label: "Die-cut · Vinyl" }],
    priceFrom: "from $0.85",
    category: "Promo",
    artIndex: 9,
    size: "sq",
  },
  {
    slug: "banners-displays",
    name: "Banners & Trade Show Displays",
    sub: "Pull-ups, mesh banners, window graphics",
    tags: [{ label: "Large format" }],
    priceFrom: "from $38.00",
    category: "Signs",
    artIndex: 10,
    size: "wide",
  },
  {
    slug: "promo-products",
    name: "Promo Products",
    tags: [{ label: "Pens · USB · Tech" }],
    priceFrom: "from $1.20",
    category: "Promo",
    artIndex: 11,
    size: "sq",
  },
  {
    slug: "uniforms-aprons",
    name: "Uniforms & Aprons",
    tags: [{ label: "Aprons · Chef" }],
    priceFrom: "from $14.00",
    category: "Apparel",
    artIndex: 12,
    size: "sq",
  },
];

export const CATEGORIES: Category[] = [
  "Apparel",
  "Bags",
  "Headwear",
  "Outerwear",
  "Polos",
  "Promo",
  "Safety",
  "Signs",
];
