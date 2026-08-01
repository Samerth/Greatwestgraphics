"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArtTile } from "@/components/shared/ArtTile";

export type BestsellerItem = {
  slug: string;
  name: string;
  price: string;
  artIndex: number;
  imageUrl?: string | null;
  href?: string;
};

const FALLBACK_ITEMS: BestsellerItem[] = [
  { slug: "premium-custom-tshirts", name: "Premium Custom Tees", price: "from $9.20", artIndex: 1 },
  { slug: "hoodies-crewnecks", name: "Hoodies & Crewnecks", price: "from $24.00", artIndex: 2 },
  { slug: "caps-beanies", name: "Caps & Beanies", price: "from $9.70", artIndex: 3 },
  { slug: "bags-totes", name: "Bags & Totes", price: "from $6.50", artIndex: 4 },
  { slug: "safety-hi-vis", name: "Safety Hi-Vis", price: "from $14.00", artIndex: 5 },
  { slug: "corporate-polos", name: "Corporate Polos", price: "from $16.00", artIndex: 6 },
  { slug: "jackets-outerwear", name: "Jackets & Outerwear", price: "from $42.00", artIndex: 7 },
  { slug: "drinkware-mugs", name: "Drinkware & Mugs", price: "from $3.20", artIndex: 8 },
];

export function BestsellerRoller({
  items = FALLBACK_ITEMS,
}: {
  items?: BestsellerItem[];
}) {
  const ITEMS = items.length > 0 ? items : FALLBACK_ITEMS;
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gentle continuous auto-scroll, pausing on hover/touch — replaces the
  // CSS @keyframes roller-scroll + JS scrollBy hybrid from the original.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf: number;
    const tick = () => {
      if (!pausedRef.current) {
        el.scrollLeft += 0.6;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
          el.scrollLeft = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  function scrollByCards(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    // The arrow buttons sit outside the scroll track, so hovering/clicking
    // them never set pausedRef via the track's mouse listeners — the
    // continuous auto-scroll kept incrementing scrollLeft every frame and
    // fought the smooth scrollBy below, making the arrows look broken.
    // Pause explicitly on click and resume after a few seconds of idle.
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, 4000);
    el.scrollBy({ left: dir * 296 * 2, behavior: "smooth" });
  }

  return (
    <section className="py-sp-8">
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24">
        <div className="flex flex-wrap justify-between items-end gap-sp-3 mb-sp-5">
          <div>
            <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              On the Rack Right Now
            </div>
            <h2 className="font-display font-bold text-header leading-header">
              Bestsellers on repeat.
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => scrollByCards(-1)}
              aria-label="Scroll left"
              className="w-10 h-10 rounded-full border border-border bg-bg-raised grid place-items-center hover:border-accent hover:bg-accent-tint transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => scrollByCards(1)}
              aria-label="Scroll right"
              className="w-10 h-10 rounded-full border border-border bg-bg-raised grid place-items-center hover:border-accent hover:bg-accent-tint transition-colors"
            >
              →
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          onMouseEnter={() => (pausedRef.current = true)}
          onMouseLeave={() => (pausedRef.current = false)}
          onTouchStart={() => (pausedRef.current = true)}
          onTouchEnd={() => (pausedRef.current = false)}
          className="flex gap-sp-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[...ITEMS, ...ITEMS].map((item, i) => (
            <Link
              key={`${item.slug}-${i}`}
              href={item.href ?? `/product/${item.slug}`}
              className="flex-none w-[280px] md:w-[320px] border border-border rounded-lg overflow-hidden bg-bg-raised hover:-translate-y-0.5 hover:shadow-card-hover hover:border-accent transition-all"
            >
              <div className="relative h-[240px] md:h-[280px]">
                <ArtTile artIndex={item.artIndex} imageSrc={item.imageUrl ?? undefined} alt={item.name} />
              </div>
              <div className="p-sp-3">
                <h4 className="font-display text-[16px] mb-1">{item.name}</h4>
                <div className="font-bold text-accent text-sm">{item.price}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
