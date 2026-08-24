import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import type { StorefrontCategory } from "@/lib/commerce/catalog";

/**
 * Photography per category slug. Slugs with no synced inventory keep an entry
 * so the tile is ready the day they get one; a slug that never arrives simply
 * never gets looked up.
 *
 * This started life as a list of sixteen fallback tiles rendered whenever the
 * category call came back empty, and eight of those slugs -- drinkware,
 * made-in-canada, swag-boxes, eco-friendly, notebooks, technology, socks,
 * patches -- are not categories the catalogue has. During an outage the
 * homepage therefore advertised eight departments that led to empty listings.
 */
const TILE_IMAGES: Record<string, string> = {
  "t-shirts": "/images/prod-tee.jpg",
  "hoodies-sweatshirts": "/images/hoodie-display.png",
  polos: "/images/category-polos.jpg",
  jackets: "/images/wardrobe_2.jpg",
  vests: "/images/prod-safety.jpg",
  workwear: "/images/wardrobe.jpg",
  hats: "/images/category-caps.jpg",
  "pants-shorts": "/images/pants.jpg",
  "athletic-wear": "/images/tshirt_2.jpg",
  bags: "/images/prod-tote.jpg",
  safety: "/images/wardrobe-3.jpg",
  accessories: "/images/category-accessories.jpg",
  "eco-friendly": "/images/accessories.jpg",
  all: "/images/category-more.jpg",
};

export function CategoryBrowse({
  categories = [],
}: {
  categories?: StorefrontCategory[];
}) {
  // Only top-level categories on the homepage grid — subcategories (Aprons,
  // Beanies, Bomber Jackets, etc.) live one click deeper via the mega menu.
  // "hoodies-and-crewnecks" is excluded: the seed script created it as a
  // separate top-level category alongside "Hoodies & Sweatshirts" (known
  // collision, see seed-categories.ts), and showing both is redundant.
  const topLevel = categories.filter(
    (c) => !c.parentId && c.slug !== "hoodies-and-crewnecks",
  );

  const tiles =
    topLevel.length > 0
      ? [
          ...topLevel.slice(0, 15).map((c) => ({
            name: c.name,
            slug: c.slug,
            image: TILE_IMAGES[c.slug],
          })),
          { name: "More", slug: "all", image: TILE_IMAGES.all },
        ]
      : [];

  // These used to be a hardcoded nine — Apparel, Bags, Outerwear, Promo,
  // Safety, Signs and friends — written against a category taxonomy the synced
  // catalogue does not use. Six of the nine resolved to no category at all, so
  // clicking them landed the shopper on an empty listing directly beneath a
  // heading promising "Real products, real methods, real starting prices".
  // Deriving them from the same list that feeds the tiles means a pill can only
  // exist for a category that has something in it.
  const pills = [
    { label: "All", href: "/products" },
    ...topLevel.slice(0, 8).map((c) => ({
      label: c.name,
      href: `/products?category=${encodeURIComponent(c.slug)}`,
    })),
  ];

  return (
    <section className="section-pad">
      <Container>
        <div className="max-w-[760px]">
          <h2 className="font-display font-bold text-header leading-header m-0 text-balance">
            Real Prints. Real Fast. Every Time.
          </h2>
          <p className="text-text-secondary mt-sp-2 mb-0 text-sm sm:text-base leading-relaxed">
            Real products, real methods, real starting prices. Filter by what you
            need (apparel, safety, promo, signage) or hover and jump into a
            category below.
          </p>
        </div>

        {/* "Sort: Popular ▾" used to sit at the end of this row. It was a
            <span>, not a control — styled to look like a sort dropdown that
            nothing was ever wired to. */}
        <div className="mt-sp-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            {pills.map((pill, index) => (
              <Link
                key={pill.label}
                href={pill.href}
                className={
                  index === 0
                    ? "inline-flex items-center rounded-sm bg-accent text-white text-sm font-bold px-3.5 py-2"
                    : "inline-flex items-center rounded-sm border border-border bg-bg-raised text-sm font-bold px-3.5 py-2 hover:border-accent hover:text-accent transition-colors"
                }
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </div>

        {tiles.length > 0 && (
        <div className="mt-sp-5 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-sp-3">
          {tiles.map((tile) => (
            <Link
              key={`${tile.slug}-${tile.name}`}
              href={
                tile.slug === "all"
                  ? "/products"
                  : `/products?category=${encodeURIComponent(tile.slug)}`
              }
              className="group relative block rounded-md overflow-hidden aspect-[282/160] min-h-[112px] border border-border"
            >
              {tile.image ? (
                <Image
                  src={tile.image}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              ) : (
                <div
                  className="absolute inset-0 bg-[linear-gradient(145deg,var(--color-accent),#0b1f4a_55%,#0D0D0D)]"
                  aria-hidden
                />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.62))]" />
              <span className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 text-center font-display font-bold text-xs sm:text-sm text-white drop-shadow line-clamp-2">
                {tile.name}
              </span>
            </Link>
          ))}
        </div>
        )}

        <div className="mt-sp-5 sm:mt-sp-6 rounded-md border border-border bg-bg-raised px-sp-4 py-sp-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-sp-3">
          <div className="min-w-0">
            <p className="font-display font-bold text-lg m-0 text-balance">
              Can&apos;t find it? We stock 1,000+ more items.
            </p>
            <p className="text-sm sm:text-base text-text-secondary m-0 mt-1 leading-relaxed">
              From custom cut-and-sew to specialty finishes, if you can brand it,
              we can make it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
            <ButtonLink
              href="/products"
              variant="primary"
              className="flex-1 sm:flex-none justify-center"
            >
              Browse Full Catalogue
            </ButtonLink>
            {/* Labelled "Ask Codchat!" — the web agency's product name on
                GWG's homepage, on a button that opens the contact form and
                not a chat. */}
            <ButtonLink
              href="/contact"
              variant="secondary"
              className="flex-1 sm:flex-none justify-center"
            >
              Ask Us
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
