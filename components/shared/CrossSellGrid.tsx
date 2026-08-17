import Link from "next/link";
import { ArtTile } from "@/components/shared/ArtTile";

export interface CrossSellItem {
  slug: string;
  name: string;
  meta: string;
  artIndex: number;
  imageUrl?: string | null;
  href?: string;
}

/**
 * `items` used to default to three hardcoded fixtures -- Drinkware "from
 * $3.20", Caps "from $2.10", Sticker Sheets "from $1.85" -- pointing at demo
 * slugs. Callers passed `items.length > 0 ? items : undefined`, so the
 * fixtures appeared precisely when the catalogue call had failed: the moment
 * we were least able to honour a price. There is no honest cross-sell to show
 * without live products, and a heading over an empty grid is its own kind of
 * stub, so the section now removes itself.
 */
export function CrossSellGrid({
  title = "Complete your project",
  items = [],
}: {
  title?: string;
  items?: CrossSellItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-center font-display font-bold text-header mb-sp-5">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-sp-3">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={item.href ?? `/product/${item.slug}`}
            className="group block border border-border rounded-lg overflow-hidden bg-bg-raised hover:-translate-y-0.5 hover:shadow-card-hover hover:border-accent transition-all"
          >
            <div className="relative w-full aspect-[4/3]">
              <ArtTile artIndex={item.artIndex} imageSrc={item.imageUrl ?? undefined} alt={item.name} />
            </div>
            <div className="p-sp-3">
              <h4 className="font-bold text-[14px] mb-0.5 truncate">{item.name}</h4>
              <span className="block text-[12px] text-text-tertiary leading-snug line-clamp-2">
                {item.meta}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}