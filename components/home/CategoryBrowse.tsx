import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import type { StorefrontCategory } from "@/lib/commerce/catalog";

const FALLBACK_CATEGORIES: Array<{ name: string; slug: string }> = [
  { name: "T-Shirts", slug: "t-shirts" },
  { name: "Hoodies and Crewnecks", slug: "hoodies-and-crewnecks" },
  { name: "Hats", slug: "hats" },
  { name: "Tote Bags", slug: "tote-bags" },
  { name: "Jackets", slug: "jackets" },
  { name: "Vests", slug: "vests" },
  { name: "Jerseys", slug: "jerseys" },
  { name: "Drinkware", slug: "drinkware" },
  { name: "Made in Canada", slug: "made-in-canada" },
  { name: "Swag Boxes", slug: "swag-boxes" },
  { name: "Eco-Friendly", slug: "eco-friendly" },
  { name: "Notebooks", slug: "notebooks" },
  { name: "Technology", slug: "technology" },
  { name: "Socks", slug: "socks" },
  { name: "Patches", slug: "patches" },
  { name: "More", slug: "all" },
];

const FILTER_PILLS = [
  { label: "All", href: "/products" },
  { label: "Apparel", href: "/products?category=apparel" },
  { label: "Bags", href: "/products?category=bags" },
  { label: "Headwear", href: "/products?category=hats" },
  { label: "Outerwear", href: "/products?category=outerwear" },
  { label: "Polos", href: "/products?category=polos" },
  { label: "Promo", href: "/products?category=promo" },
  { label: "Safety", href: "/products?category=safety" },
  { label: "Signs", href: "/products?category=signs" },
];

export function CategoryBrowse({
  categories = [],
}: {
  categories?: StorefrontCategory[];
}) {
  const tiles =
    categories.length > 0
      ? [
          ...categories.slice(0, 15).map((c) => ({
            name: c.name,
            slug: c.slug,
          })),
          { name: "More", slug: "all" },
        ]
      : FALLBACK_CATEGORIES;

  return (
    <section className="py-sp-8 bg-bg-raised">
      <Container>
        <div className="max-w-[760px]">
          <h2 className="font-display font-bold text-header leading-header">
            Real Prints. Real Fast. Every Time.
          </h2>
          <p className="text-text-secondary mt-sp-2">
            Real products, real methods, real starting prices. Filter by what
            you need (apparel, safety, promo, signage) or jump straight into a
            category below.
          </p>
        </div>

        <div className="mt-sp-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_PILLS.map((pill, index) => (
              <Link
                key={pill.label}
                href={pill.href}
                className={
                  index === 0
                    ? "inline-flex items-center rounded-sm bg-accent text-white text-sm font-bold px-4 py-2"
                    : "inline-flex items-center rounded-sm border border-border bg-bg text-sm font-bold px-4 py-2 hover:border-accent hover:text-accent transition-colors"
                }
              >
                {pill.label}
              </Link>
            ))}
          </div>
          <Link
            href="/products"
            className="text-sm font-bold text-text-secondary hover:text-accent transition-colors"
          >
            Sort: Popular ▾
          </Link>
        </div>

        <div className="mt-sp-5 grid grid-cols-2 md:grid-cols-4 gap-sp-3">
          {tiles.map((tile) => (
            <Link
              key={`${tile.slug}-${tile.name}`}
              href={
                tile.slug === "all"
                  ? "/products"
                  : `/products?category=${encodeURIComponent(tile.slug)}`
              }
              className="group block rounded-md border border-border bg-bg overflow-hidden hover:border-accent transition-colors"
            >
              <div
                className="aspect-[282/200] bg-[linear-gradient(145deg,var(--color-accent-tint),var(--color-fill-subtle-15)_55%,var(--color-bg))]"
                aria-hidden
              />
              <div className="px-3 py-3 text-center">
                <span className="font-display font-bold text-sm group-hover:text-accent transition-colors">
                  {tile.name}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-sp-6 rounded-md border border-border bg-bg px-sp-4 py-sp-4 flex flex-wrap items-center justify-between gap-sp-3">
          <div>
            <p className="font-display font-bold text-lg m-0">
              Can&apos;t find it? We stock 1,000+ more items.
            </p>
            <p className="text-sm text-text-secondary m-0 mt-1">
              From custom cut-and-sew to specialty finishes, if you can brand it,
              we can make it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href="/products" variant="primary">
              Browse Full Catalogue
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Ask Codchat!
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
