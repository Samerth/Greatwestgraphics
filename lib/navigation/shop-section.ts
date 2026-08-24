import type { StorefrontCategory } from "@/lib/commerce/catalog";

/**
 * The Shop mega-menu used to dump every top-level category into one flat
 * 4-column grid, which meant "Aprons" sat next to "Bomber Jackets" with no
 * hierarchy and the panel scrolled. The catalogue's own category tree has no
 * grouping layer above the top-level categories, so the grouping lives here:
 * a keyword match on the category name/slug that sorts each live category into
 * a merchandising section. Anything we don't recognise still shows up (under
 * "More to Shop"), so a new catalogue category can never silently disappear
 * from the menu.
 */

export type CategoryNode = StorefrontCategory & {
  children: StorefrontCategory[];
};

export type ShopGroup = {
  id: string;
  label: string;
  categories: CategoryNode[];
};

export type ShopSection = {
  id: string;
  label: string;
  /** One line shown at the top of the panel. */
  blurb: string;
  groups: ShopGroup[];
};

type GroupRule = {
  id: string;
  label: string;
  /** Section this group belongs to. */
  section: string;
  match: RegExp;
};

const SECTION_META: { id: string; label: string; blurb: string }[] = [
  {
    id: "apparel",
    label: "Apparel",
    blurb: "Tees, fleece, layers and bottoms — printed or embroidered in-house.",
  },
  {
    id: "headwear-bags",
    label: "Headwear & Bags",
    blurb: "Caps, beanies, totes and travel bags built for logo work.",
  },
  {
    id: "workwear",
    label: "Workwear & Safety",
    blurb: "Crew uniforms, hi-vis and shop-floor gear that survives the job.",
  },
  {
    id: "specialty",
    label: "Eco & Specialty",
    blurb: "Recycled, organic and everything else in the catalogue.",
  },
];

/** Order matters: the first rule that matches wins. */
const GROUP_RULES: GroupRule[] = [
  {
    id: "tops",
    label: "T-Shirts & Tops",
    section: "apparel",
    match: /(t-?shirt|tee\b|tank|polo|jersey|sleeve|tri-?blend|blouse|shirt)/i,
  },
  {
    id: "fleece",
    label: "Hoodies & Sweatshirts",
    section: "apparel",
    match: /(hood|sweatshirt|crewneck|quarter ?zip|full ?zip|pullover)/i,
  },
  {
    id: "outerwear",
    label: "Jackets & Outerwear",
    section: "apparel",
    match: /(jacket|outerwear|vest|softshell|soft ?shell|bomber|windbreaker|parka|insulated)/i,
  },
  {
    id: "bottoms",
    label: "Bottoms & Athletic",
    section: "apparel",
    match: /(pant|short|jogger|sweatpant|legging|athletic|activewear|performance)/i,
  },
  {
    id: "hats",
    label: "Hats & Headwear",
    section: "headwear-bags",
    match: /(hat|cap\b|beanie|toque|snapback|trucker|visor|headwear|bucket)/i,
  },
  {
    id: "bags",
    label: "Bags & Carry",
    section: "headwear-bags",
    match: /(bag|backpack|tote|duffel|duffle|cooler|pack\b|luggage)/i,
  },
  {
    id: "accessories",
    label: "Accessories",
    section: "headwear-bags",
    match: /(accessor|apron|glove|sock|scarf|towel|blanket|lanyard|drinkware|mug)/i,
  },
  {
    id: "work",
    label: "Workwear",
    section: "workwear",
    match: /(work|coverall|uniform|trade|shop ?wear)/i,
  },
  {
    id: "safety",
    label: "Safety & Hi-Vis",
    section: "workwear",
    match: /(safety|hi-?vis|high ?visibility|reflective|flame|fr\b)/i,
  },
  {
    id: "eco",
    label: "Eco-Friendly",
    section: "specialty",
    match: /(eco|recycl|organic|sustainab|bamboo|hemp)/i,
  },
  {
    id: "promo",
    label: "Promo & Signage",
    section: "specialty",
    match: /(promo|sign|banner|sticker|decal|display|gift)/i,
  },
];

const FALLBACK_GROUP = {
  id: "more",
  label: "More to Shop",
  section: "specialty",
};

export function buildCategoryTree(
  categories: StorefrontCategory[],
): CategoryNode[] {
  return categories
    .filter((c) => !c.parentId)
    .map((top) => ({
      ...top,
      children: categories.filter((c) => c.parentId === top.id),
    }));
}

function ruleFor(node: CategoryNode): { id: string; label: string; section: string } {
  const haystack = `${node.name} ${node.slug}`;
  return GROUP_RULES.find((rule) => rule.match.test(haystack)) ?? FALLBACK_GROUP;
}

/**
 * Sorts the live category tree into sections. Empty sections and empty groups
 * are dropped, so the menu never renders a heading with nothing under it.
 */
export function buildShopSections(tree: CategoryNode[]): ShopSection[] {
  const groups = new Map<string, ShopGroup & { section: string }>();

  for (const node of tree) {
    const rule = ruleFor(node);
    const existing = groups.get(rule.id);
    if (existing) {
      existing.categories.push(node);
    } else {
      groups.set(rule.id, {
        id: rule.id,
        label: rule.label,
        section: rule.section,
        categories: [node],
      });
    }
  }

  return SECTION_META.map((meta) => ({
    ...meta,
    groups: [...groups.values()]
      .filter((g) => g.section === meta.id)
      .map(({ section: _section, ...group }) => group),
  })).filter((section) => section.groups.length > 0);
}

/** Right-hand rail: entry points that aren't catalogue categories. */
export const SHOP_BY_USE: { label: string; href: string; hint: string }[] = [
  { label: "Corporate", href: "/products?q=corporate", hint: "Staff kits & client gifts" },
  { label: "Teams & Sport", href: "/products?q=jersey", hint: "Jerseys and warmups" },
  { label: "Schools", href: "/products?q=school", hint: "Grad wear and spirit wear" },
  { label: "Hospitality", href: "/products?q=apron", hint: "Front-of-house uniforms" },
  { label: "Trades & Safety", href: "/products?q=hi-vis", hint: "Hi-vis and workwear" },
  { label: "Streetwear", href: "/products?q=heavyweight", hint: "Heavyweight drops" },
];

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
