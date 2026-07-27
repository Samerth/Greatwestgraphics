"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { ArtTile } from "@/components/shared/ArtTile";
import { CATALOG, CATEGORIES, type Category } from "@/lib/data/products";

type SortKey = "popular" | "price-asc" | "new";

const SIZE_CLASSES: Record<string, string> = {
  hero: "col-span-6 md:col-span-7 row-span-2",
  tall: "col-span-6 md:col-span-5 row-span-2",
  wide: "col-span-6",
  sq: "col-span-3 md:col-span-4",
};

export function ProductsGrid({
  initialCategory = "All",
}: {
  initialCategory?: Category | "All";
}) {
  const [activeCategory, setActiveCategory] = useState<Category | "All">(initialCategory);
  const [sort, setSort] = useState<SortKey>("popular");
  const [hovered, setHovered] = useState<string | null>(null);

  const tiles = useMemo(() => {
    let list =
      activeCategory === "All"
        ? CATALOG
        : CATALOG.filter((t) => t.category === activeCategory);

    if (sort === "price-asc") {
      list = [...list].sort((a, b) => {
        const parse = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
        return parse(a.priceFrom) - parse(b.priceFrom);
      });
    } else if (sort === "new") {
      list = [...list].reverse();
    }
    return list;
  }, [activeCategory, sort]);

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-sp-3 mb-sp-5">
        <div className="flex flex-wrap gap-2">
          <Chip active={activeCategory === "All"} onClick={() => setActiveCategory("All")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="border border-border rounded-sm bg-bg-raised px-3 py-2 text-sm font-semibold"
        >
          <option value="popular">Most popular</option>
          <option value="price-asc">Price: low to high</option>
          <option value="new">New arrivals</option>
        </select>
      </div>

      <div
        className="grid grid-cols-6 md:grid-cols-12 auto-rows-[200px] md:auto-rows-[240px] gap-sp-3"
        onMouseLeave={() => setHovered(null)}
      >
        <AnimatePresence mode="popLayout">
          {tiles.map((tile) => {
            const isDimmed = hovered !== null && hovered !== tile.slug;
            const isHovered = hovered === tile.slug;

            return (
              <motion.div
                key={tile.slug}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{
                  opacity: isDimmed ? 0.4 : 1,
                  scale: isHovered ? 1.015 : 1,
                }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.16, 0.8, 0.3, 1] }}
                onMouseEnter={() => setHovered(tile.slug)}
                className={SIZE_CLASSES[tile.size]}
              >
                <Link
                  href={`/product/${tile.slug}`}
                  className="relative block w-full h-full rounded-lg overflow-hidden border border-border bg-bg-raised group"
                >
                  <ArtTile artIndex={tile.artIndex} alt={tile.name} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,.65)_100%)] z-[1]" />

                  <div className="absolute top-3.5 left-3.5 flex gap-1.5 z-[2]">
                    {tile.tags.map((tag) => (
                      <span
                        key={tag.label}
                        className={cn(
                          "text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full border",
                          tag.primary
                            ? "bg-accent border-accent text-white"
                            : "bg-white/90 border-border text-text-primary"
                        )}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>

                  <div className="absolute left-4 right-4 bottom-3.5 z-[2]">
                    <h4 className="font-display text-white text-[19px] mb-1 [text-shadow:0_1px_6px_rgba(0,0,0,.4)]">
                      {tile.name}
                    </h4>
                    {tile.sub && (
                      <p className="text-white/85 text-[12.5px] [text-shadow:0_1px_6px_rgba(0,0,0,.4)]">
                        {tile.sub}
                      </p>
                    )}
                  </div>

                  <div className="absolute right-4 bottom-3.5 z-[2] bg-bg-raised text-text-primary text-xs font-bold px-2.5 py-1.5 rounded-sm">
                    {tile.priceFrom}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-accent border-accent text-white"
          : "bg-transparent border-border text-text-primary hover:border-text-tertiary"
      )}
    >
      {children}
    </button>
  );
}