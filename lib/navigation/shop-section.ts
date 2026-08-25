import type { StorefrontCategory } from "@/lib/commerce/catalog";

/**
 * The Shop menu is now driven by the published GWG taxonomy below, not by a
 * regex guess over whatever the commerce API happens to return. The taxonomy
 * is the source of truth for structure and labels; the live catalogue is only
 * used to resolve real category slugs and to flag which entries currently
 * have a browsable category page (`isLive`).
 *
 * Departments: Apparel, Promotional Products, Signs & Displays, Print Products.
 * Brands / Industries / Services / Resources are exported separately because
 * they are nav destinations, not catalogue departments.
 */

/* ------------------------------------------------------------------ types */

export type CategoryNode = StorefrontCategory & { children: CategoryNode[] };

export type ShopNode = {
  id: string;
  name: string;
  href: string;
  /** True when a real catalogue category backs this taxonomy entry. */
  isLive: boolean;
  children: ShopNode[];
};

export type ShopGroup = {
  id: string;
  label: string;
  /** Set when the group heading itself is a taxonomy category with a page. */
  href?: string;
  categories: ShopNode[];
};

export type ShopSection = {
  id: string;
  label: string;
  /** One line shown at the top of the panel. */
  blurb: string;
  groups: ShopGroup[];
};

/* --------------------------------------------------------------- taxonomy */

type TaxonomyEntry = { label: string; children?: TaxonomyEntry[] };
type TaxonomyDepartment = {
  id: string;
  label: string;
  blurb: string;
  categories: TaxonomyEntry[];
};

const TAXONOMY: TaxonomyDepartment[] = [
  {
    id: "apparel",
    label: "Apparel",
    blurb: "Tees, fleece, layers, workwear and bags — printed or embroidered in-house.",
    categories: [
      {
        label: "T-Shirts",
        children: [
          { label: "Short Sleeve" },
          { label: "Long Sleeve" },
          { label: "Heavyweight" },
          { label: "Lightweight" },
          { label: "Performance" },
          { label: "Tri-Blend" },
          { label: "Pocket Tees" },
          { label: "Organic" },
          { label: "Tall" },
          { label: "Women\u2019s" },
          { label: "Youth" },
        ],
      },
      {
        label: "Hoodies & Sweatshirts",
        children: [
          { label: "Pullover Hoodies" },
          { label: "Zip Hoodies" },
          { label: "Crewnecks" },
          { label: "Quarter Zips" },
          { label: "Heavyweight" },
          { label: "Lightweight" },
          { label: "Performance" },
          { label: "Fleece" },
          { label: "Women\u2019s" },
          { label: "Youth" },
        ],
      },
      {
        label: "Polos",
        children: [
          { label: "Cotton" },
          { label: "Performance" },
          { label: "Long Sleeve" },
          { label: "Women\u2019s" },
          { label: "Youth" },
        ],
      },
      {
        label: "Jackets",
        children: [
          { label: "Softshell" },
          { label: "Rain Jackets" },
          { label: "Windbreakers" },
          { label: "Winter Jackets" },
          { label: "Bomber Jackets" },
          { label: "Insulated" },
          { label: "Fleece Jackets" },
          { label: "Packable Jackets" },
        ],
      },
      {
        label: "Vests",
        children: [
          { label: "Softshell" },
          { label: "Fleece" },
          { label: "Insulated" },
          { label: "Puffy" },
        ],
      },
      {
        label: "Workwear",
        children: [
          { label: "Hi-Vis Shirts" },
          { label: "Hi-Vis Hoodies" },
          { label: "Hi-Vis Jackets" },
          { label: "Work Shirts" },
          { label: "Work Pants" },
          { label: "Coveralls" },
          { label: "FR Apparel" },
        ],
      },
      {
        label: "Hats",
        children: [
          { label: "Snapbacks" },
          { label: "Trucker Hats" },
          { label: "Dad Hats" },
          { label: "Fitted Hats" },
          { label: "Flexfit" },
          { label: "New Era" },
          { label: "Toques" },
          { label: "Beanies" },
          { label: "Bucket Hats" },
          { label: "Visors" },
        ],
      },
      {
        label: "Pants & Shorts",
        children: [
          { label: "Joggers" },
          { label: "Sweatpants" },
          { label: "Athletic Pants" },
          { label: "Work Pants" },
          { label: "Shorts" },
          { label: "Cargo Shorts" },
        ],
      },
      {
        label: "Athletic Wear",
        children: [
          { label: "Jerseys" },
          { label: "Teamwear" },
          { label: "Performance Shirts" },
          { label: "Compression" },
          { label: "Warm-Ups" },
        ],
      },
      {
        label: "Bags",
        children: [
          { label: "Backpacks" },
          { label: "Duffel Bags" },
          { label: "Tote Bags" },
          { label: "Drawstring Bags" },
          { label: "Messenger Bags" },
          { label: "Laptop Bags" },
        ],
      },
      { label: "Women\u2019s Apparel" },
      { label: "Youth Apparel" },
      {
        label: "Accessories",
        children: [
          { label: "Aprons" },
          { label: "Blankets" },
          { label: "Towels" },
          { label: "Gloves" },
          { label: "Scarves" },
          { label: "Socks" },
          { label: "Umbrellas" },
        ],
      },
    ],
  },
  {
    id: "promotional-products",
    label: "Promotional Products",
    blurb: "Drinkware, office, tech, awards and trade-show giveaways.",
    categories: [
      {
        label: "Drinkware",
        children: [
          { label: "Water Bottles" },
          { label: "Tumblers" },
          { label: "Travel Mugs" },
          { label: "Coffee Mugs" },
          { label: "Glassware" },
        ],
      },
      {
        label: "Office",
        children: [
          { label: "Pens" },
          { label: "Journals" },
          { label: "Notebooks" },
          { label: "Calendars" },
          { label: "Mouse Pads" },
        ],
      },
      {
        label: "Technology",
        children: [
          { label: "USB Drives" },
          { label: "Chargers" },
          { label: "Power Banks" },
          { label: "Speakers" },
          { label: "Headphones" },
        ],
      },
      {
        label: "Bags",
        children: [
          { label: "Tote Bags" },
          { label: "Grocery Bags" },
          { label: "Cooler Bags" },
          { label: "Backpacks" },
        ],
      },
      {
        label: "Awards",
        children: [
          { label: "Plaques" },
          { label: "Crystal Awards" },
          { label: "Trophies" },
          { label: "Medals" },
        ],
      },
      {
        label: "Trade Show",
        children: [
          { label: "Lanyards" },
          { label: "Name Badges" },
          { label: "Table Covers" },
          { label: "Booth Accessories" },
        ],
      },
      {
        label: "Outdoor",
        children: [
          { label: "Coolers" },
          { label: "BBQ Sets" },
          { label: "Chairs" },
          { label: "Blankets" },
        ],
      },
      {
        label: "Health & Wellness",
        children: [
          { label: "First Aid" },
          { label: "Sanitizer" },
          { label: "Fitness Items" },
        ],
      },
      {
        label: "Eco-Friendly",
        children: [
          { label: "Bamboo" },
          { label: "Recycled Products" },
          { label: "Sustainable Drinkware" },
          { label: "Wheat Straw Products" },
        ],
      },
    ],
  },
  {
    id: "signs-displays",
    label: "Signs & Displays",
    blurb: "Signage, banners, trade-show displays, vehicle and window graphics.",
    categories: [
      {
        label: "Indoor Signs",
        children: [
          { label: "Foam Board" },
          { label: "PVC" },
          { label: "Acrylic" },
          { label: "Aluminum" },
          { label: "Sintra" },
          { label: "Dibond" },
        ],
      },
      {
        label: "Outdoor Signs",
        children: [
          { label: "Coroplast" },
          { label: "Aluminum Composite" },
          { label: "Yard Signs" },
          { label: "Parking Signs" },
          { label: "Construction Signs" },
        ],
      },
      {
        label: "Banners",
        children: [
          { label: "Vinyl Banners" },
          { label: "Mesh Banners" },
          { label: "Pole Banners" },
          { label: "Double-Sided Banners" },
        ],
      },
      {
        label: "Banner Stands",
        children: [
          { label: "Retractable Banner Stands" },
          { label: "X-Banners" },
          { label: "L-Banners" },
        ],
      },
      {
        label: "Trade Show Displays",
        children: [
          { label: "Pop-Up Displays" },
          { label: "Fabric Displays" },
          { label: "Backdrops" },
          { label: "Table Throws" },
          { label: "Counters" },
          { label: "Kiosks" },
        ],
      },
      {
        label: "Window Graphics",
        children: [
          { label: "Window Decals" },
          { label: "Perforated Vinyl" },
          { label: "Frosted Vinyl" },
        ],
      },
      {
        label: "Wall Graphics",
        children: [
          { label: "Wall Murals" },
          { label: "Wall Decals" },
          { label: "Wallpaper" },
        ],
      },
      { label: "Floor Graphics" },
      {
        label: "Vehicle Graphics",
        children: [
          { label: "Vehicle Decals" },
          { label: "Vehicle Magnets" },
          { label: "Fleet Graphics" },
        ],
      },
      {
        label: "Stickers & Labels",
        children: [
          { label: "Die Cut" },
          { label: "Kiss Cut" },
          { label: "Roll Labels" },
          { label: "Window Stickers" },
          { label: "Bumper Stickers" },
        ],
      },
      {
        label: "Flags",
        children: [
          { label: "Feather Flags" },
          { label: "Teardrop Flags" },
          { label: "Pole Flags" },
        ],
      },
      { label: "Tents & Canopies" },
      { label: "A-Frame Signs" },
      { label: "Posters" },
      { label: "Canvas Prints" },
    ],
  },
  {
    id: "print-products",
    label: "Print Products",
    blurb: "Business cards, marketing collateral and business forms.",
    categories: [
      { label: "Business Cards" },
      { label: "Flyers" },
      { label: "Brochures" },
      { label: "Booklets" },
      { label: "Postcards" },
      { label: "Presentation Folders" },
      { label: "Letterhead" },
      { label: "Envelopes" },
      { label: "NCR Forms" },
      { label: "Notepads" },
      { label: "Catalogs" },
      { label: "Menus" },
      { label: "Invitations" },
      { label: "Greeting Cards" },
    ],
  },
];

/* ------------------------------------------------- live catalogue matching */

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/\u2019|'/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Recursive: keeps every level of the catalogue tree, not just two. */
export function buildCategoryTree(
  categories: StorefrontCategory[],
): CategoryNode[] {
  const byParent = new Map<string | null, StorefrontCategory[]>();
  for (const c of categories) {
    const key = c.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const build = (parentId: string | null): CategoryNode[] =>
    (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: build(c.id) }));
  return build(null);
}

type LiveIndex = {
  bySlug: Map<string, StorefrontCategory>;
  byName: Map<string, StorefrontCategory[]>;
};

function indexLive(tree: CategoryNode[]): LiveIndex {
  const bySlug = new Map<string, StorefrontCategory>();
  const byName = new Map<string, StorefrontCategory[]>();
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      bySlug.set(node.slug.toLowerCase(), node);
      const nameKey = slugify(node.name);
      byName.set(nameKey, [...(byName.get(nameKey) ?? []), node]);
      walk(node.children);
    }
  };
  walk(tree);
  return { bySlug, byName };
}

/** Duplicate labels such as Performance, Women's, Bags and Blankets must be
 * resolved under their taxonomy parent. A global name lookup points several
 * menu entries at the first category with that label, which is the source of
 * the "undefined"/wrong-page links after the taxonomy expansion. */
function findLiveCategory(
  entry: TaxonomyEntry,
  live: LiveIndex,
  parentId?: string,
): StorefrontCategory | undefined {
  const key = slugify(entry.label);
  const exactSlug = live.bySlug.get(key);
  if (exactSlug && (!parentId || exactSlug.parentId === parentId)) {
    return exactSlug;
  }
  const sameName = live.byName.get(key) ?? [];
  if (parentId) return sameName.find((category) => category.parentId === parentId);
  return sameName.find((category) => category.parentId === null) ?? sameName[0];
}

const categoryHref = (slug: string) =>
  `/products?category=${encodeURIComponent(slug)}`;

function toShopNode(
  entry: TaxonomyEntry,
  path: string[],
  live: LiveIndex,
  fallbackHref: string,
): ShopNode {
  const key = slugify(entry.label);
  const parentMatchId = path.at(-1)?.startsWith("live-id:")
    ? path.at(-1)?.slice("live-id:".length)
    : undefined;
  const match = findLiveCategory(entry, live, parentMatchId);
  const href = match ? categoryHref(match.slug) : fallbackHref;
  const id = [...path.filter((part) => !part.startsWith("live-id:")), key].join("/");
  const childPath = match
    ? [...path.filter((part) => !part.startsWith("live-id:")), key, `live-id:${match.id}`]
    : [...path, key];
  return {
    id,
    name: entry.label,
    href,
    isLive: Boolean(match),
    children: (entry.children ?? []).map((child) =>
      toShopNode(child, childPath, live, href),
    ),
  };
}

/**
 * Builds the menu from the taxonomy, resolving hrefs against the live
 * catalogue. A taxonomy entry with no catalogue match links to its nearest
 * matched ancestor (or /products) and is flagged `isLive: false` so the UI can
 * mute it. Live catalogue top-level categories that aren't in the taxonomy are
 * appended as a final "Also in the Catalogue" department, so nothing that has
 * real inventory can silently disappear.
 */
export function buildShopSections(tree: CategoryNode[]): ShopSection[] {
  const live = indexLive(tree);
  const claimed = new Set<string>();

  const claim = (entry: TaxonomyEntry, parentId?: string) => {
    const match = findLiveCategory(entry, live, parentId);
    if (match) claimed.add(match.id);
    (entry.children ?? []).forEach((child) => claim(child, match?.id));
  };
  TAXONOMY.forEach((dept) => dept.categories.forEach((entry) => claim(entry)));

  const sections: ShopSection[] = TAXONOMY.map((dept) => {
    const groups: ShopGroup[] = [];
    const flat: ShopNode[] = [];

    for (const category of dept.categories) {
      const node = toShopNode(category, [dept.id], live, "/products");
      if (node.children.length > 0) {
        groups.push({
          id: node.id,
          label: node.name,
          href: node.href,
          categories: node.children,
        });
      } else {
        flat.push(node);
      }
    }

    // Childless categories (Print Products, Floor Graphics, Posters…) share a
    // single column headed by the department name rather than each getting an
    // empty heading of its own.
    if (flat.length > 0) {
      groups.push({
        id: `${dept.id}/all`,
        label: dept.label,
        categories: flat,
      });
    }

    return { id: dept.id, label: dept.label, blurb: dept.blurb, groups };
  });

  const unclaimed = tree.filter((node) => !claimed.has(node.id));
  if (unclaimed.length > 0) {
    const toLiveNode = (node: CategoryNode): ShopNode => ({
      id: `live/${node.id}`,
      name: node.name,
      href: categoryHref(node.slug),
      isLive: true,
      children: node.children.map(toLiveNode),
    });
    sections.push({
      id: "catalogue-extra",
      label: "Also in the Catalogue",
      blurb: "Live catalogue categories not yet placed in the taxonomy.",
      groups: [
        {
          id: "catalogue-extra/all",
          label: "Also in the Catalogue",
          categories: unclaimed.map(toLiveNode),
        },
      ],
    });
  }

  return sections.filter((section) => section.groups.length > 0);
}

/* -------------------------------------------------- non-catalogue nav data */

/** Industries — replaces the old SHOP_BY_USE keyword-search shortcuts. */
export const SHOP_INDUSTRIES: { label: string; href: string }[] = [
  "Construction",
  "Corporate",
  "Schools",
  "Universities",
  "Sports Teams",
  "Healthcare",
  "Restaurants",
  "Hospitality",
  "Manufacturing",
  "Trades",
  "Government",
  "Non-Profit",
  "Real Estate",
  "Retail",
  "Fitness",
  "Churches",
  "Automotive",
  "Events",
].map((label) => ({ label, href: `/industries/${slugify(label)}` }));

/** Services — taxonomy order preserved. */
export const SHOP_SERVICE_LINKS: { label: string; href: string }[] = [
  "Screen Printing",
  "Embroidery",
  "DTF Printing",
  "Contract Printing",
  "Graphic Design",
  "Company Stores",
  "Warehousing",
  "Fulfillment",
  "Rush Orders",
  "Canada-Wide Shipping",
  "Artwork Cleanup",
].map((label) => ({ label, href: `/services/${slugify(label)}` }));

export const SHOP_RESOURCES: { label: string; href: string }[] = [
  { label: "Size Charts", href: "/size-charts" },
  { label: "Artwork Guidelines", href: "/artwork-guidelines" },
  { label: "FAQ", href: "/faq" },
  { label: "Blog", href: "/blog" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "Request a Quote", href: "/quote" },
];

/**
 * Brands are meant to populate from supplier integrations; this list is only
 * the seed order for the Brands landing page until that feed exists.
 */
export const SHOP_BRAND_SEED: string[] = [
  "Nike",
  "Adidas",
  "Under Armour",
  "Carhartt",
  "AS Colour",
  "Gildan",
  "ATC",
  "Bella+Canvas",
  "Next Level",
  "Champion",
  "Stormtech",
  "Richardson",
  "Flexfit",
  "New Era",
  "Columbia",
  "The North Face",
  "M&O",
  "Independent Trading Co.",
];

/** Right-hand rail: entry points that aren't catalogue categories. */
export const SHOP_SERVICES: { label: string; href: string; hint: string }[] = [
  {
    label: "Design Studio",
    href: "/design",
    hint: "Upload art and preview it on real garments.",
  },
  {
    label: "Get a Quote",
    href: "/quote",
    hint: "Real-time pricing on your run size.",
  },
  {
    label: "Corporate & Team Stores",
    href: "/start",
    hint: "Branded stores with per-store pricing.",
  },
];
