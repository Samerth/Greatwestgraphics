/** Default storefront nav when the commerce API categories are unavailable. */
export const DEFAULT_NAV_CATEGORIES = [
  { label: "T-Shirts", href: "/products?category=t-shirts", slug: "t-shirts" },
  {
    label: "Hoodies",
    href: "/products?category=hoodies-and-crewnecks",
    slug: "hoodies-and-crewnecks",
  },
  { label: "Hats", href: "/products?category=hats", slug: "hats" },
  { label: "Tote Bags", href: "/products?category=tote-bags", slug: "tote-bags" },
  { label: "Jackets", href: "/products?category=jackets", slug: "jackets" },
  { label: "Drinkware", href: "/products?category=drinkware", slug: "drinkware" },
  {
    label: "Made In Canada",
    href: "/products?category=made-in-canada",
    slug: "made-in-canada",
  },
  {
    label: "Eco-Friendly",
    href: "/products?category=eco-friendly",
    slug: "eco-friendly",
  },
] as const;
