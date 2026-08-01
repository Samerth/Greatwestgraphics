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

const DEFAULT_ITEMS: CrossSellItem[] = [
  { slug: "drinkware-mugs", name: "Drinkware", meta: "11oz ceramic — from $3.20", artIndex: 8 },
  { slug: "caps-beanies", name: "Caps", meta: "Custom woven, badge clip — from $2.10", artIndex: 11 },
  { slug: "stickers-decals", name: "Sticker Sheets", meta: "Die-cut, weatherproof — from $1.85", artIndex: 9 },
];

export function CrossSellGrid({
  title = "Complete your project",
  items = DEFAULT_ITEMS,
}: {
  title?: string;
  items?: CrossSellItem[];
}) {
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