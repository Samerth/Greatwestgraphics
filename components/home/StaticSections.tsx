"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ButtonLink } from "@/components/shared/Button";
import { Container } from "@/components/shared/Container";
import { publicQuoteOrFallback, SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

const TRUST_LOGOS = [
  { name: "Marriott", src: "/images/marriott.png" },
  { name: "Fujitsu", src: "/images/fujitsu.png" },
  { name: "Grande West", src: "/images/grande_west.png" },
  { name: "Unity Collective", src: "/images/company_logo.png" },
  { name: "St. George's", src: "/images/company_logo_2.png" },
];

export function TrustStrip() {
  return (
    <section className="section-pad text-center border-y border-border bg-bg-raised">
      <Container>
        <p className="font-bold text-text-secondary m-0 mb-sp-5 text-balance">
          Trusted by enterprise, education, and hospitality brands.
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-sp-5 gap-y-sp-4">
          {TRUST_LOGOS.map((logo) =>
            logo.src ? (
              <div
                key={logo.name}
                className="relative h-9 sm:h-10 w-[100px] sm:w-[120px] opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  fill
                  className="object-contain"
                  sizes="120px"
                />
              </div>
            ) : (
              <span
                key={logo.name}
                className="font-display font-bold text-base sm:text-lg text-text-secondary"
              >
                {logo.name}
              </span>
            ),
          )}
        </div>
      </Container>
    </section>
  );
}

const TESTIMONIALS = [
  { text: "Good fast turnover and good quality product", who: "Nabil Khan" },
  {
    text: "Good quality of work, better services, and the work was done in the given time period",
    who: "Singh Saini",
  },
  {
    text: "Great customer service, ordered custom merchandise with no hassle, and received quickly",
    who: "Ahuja",
  },
];

export function Testimonials() {
  return (
    <section className="section-pad scroll-section" id="reviews">
      <Container>
        <h2 className="text-center font-display font-bold text-header m-0 text-balance">
          What Our Clients Say
        </h2>
        {/* The "4.8/5 · 214 reviews" strip that used to sit here, and its "See
            all reviews" link back to this same section, were both invented —
            there is no review store behind them. The three quotes below are
            real and are all we can substantiate today. */}
        <div className="mt-sp-2 mb-sp-6 text-center text-sm sm:text-base text-text-secondary">
          Reviews left by Vancouver businesses we print for.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3">
          {TESTIMONIALS.map((t, index) => (
            <motion.article
              key={t.who}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
              className="bg-bg-raised border border-border rounded-md p-sp-4"
            >
              <div className="text-accent text-sm mb-sp-2" aria-hidden>
                ★★★★★
              </div>
              <p className="mb-sp-3 m-0 text-base leading-relaxed text-text-primary">
                {t.text}
              </p>
              <div className="text-sm text-text-tertiary font-bold">{t.who}</div>
            </motion.article>
          ))}
        </div>
      </Container>
    </section>
  );
}

export type GalleryItem = {
  name: string;
  meta: string;
  imageUrl: string;
};

/**
 * Photographs of our own floor and finished work.
 *
 * This section used to caption each tile with a named client — Marriott,
 * Fujitsu, St. George's School — over an image picked from the synced blanks
 * catalogue by list position, so "Marriott · Staff uniforms · embroidered" was
 * illustrated by whichever undecorated garment happened to land at that index,
 * and by a bare colour gradient whenever the catalogue call came back empty. A
 * section headed "Real Work, Delivered" was the one place on the site showing
 * none of it. Those clients are real and are still named on /about and in the
 * trust strip; what we lack is photography of their jobs, so the tiles show
 * work we can actually stand behind until that photography exists.
 */
const GALLERY: GalleryItem[] = [
  {
    name: "On the press",
    meta: "Screen printing · cured to survive the wash",
    imageUrl: "/images/shop-press.jpg",
  },
  {
    name: "Thread floor",
    meta: "Embroidery · digitized stitch by stitch",
    imageUrl: "/images/shop-embroidery.jpg",
  },
  {
    name: "Headwear",
    meta: "Caps & beanies · embroidered and printed",
    imageUrl: "/images/cap-printing.jpg",
  },
  {
    name: "Ink room",
    meta: "Hand-mixed · Pantone matched",
    imageUrl: "/images/shop-ink.jpg",
  },
  {
    name: "Large format",
    meta: "Banners, displays & window graphics",
    imageUrl: "/images/display.jpg",
  },
  {
    name: "Finished and folded",
    meta: "Counted twice before anything ships",
    imageUrl: "/images/shop-packing.jpg",
  },
  {
    name: "Out the door",
    meta: "Local pickup & Canada-wide courier",
    imageUrl: "/images/caps-display.jpg",
  },
];

export function Gallery({ items = GALLERY }: { items?: GalleryItem[] }) {
  const gallery = items.length > 0 ? items : GALLERY;
  return (
    <section className="section-pad scroll-section" id="gallery">
      <Container>
        <h2 className="text-center font-display font-bold text-header m-0 mb-sp-5 sm:mb-sp-6 text-balance">
          Real Work, Delivered
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-sp-3">
          {gallery.slice(0, 4).map((g) => (
            <GalleryTile key={g.name} item={g} aspect="aspect-[308/280]" />
          ))}
        </div>
        <div className="mt-2 sm:mt-sp-3 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-sp-3">
          {gallery.slice(4, 7).map((g) => (
            <GalleryTile key={g.name} item={g} aspect="aspect-[416/280]" />
          ))}
        </div>
      </Container>
    </section>
  );
}

function GalleryTile({
  item,
  aspect,
}: {
  item: GalleryItem;
  aspect: string;
}) {
  return (
    <Link
      href={publicQuoteOrFallback("/design")}
      className={`relative rounded-md overflow-hidden ${aspect} group block`}
    >
      <Image
        src={item.imageUrl}
        alt={item.name}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
        sizes="(max-width: 768px) 50vw, 25vw"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,.78)_100%)]" />
      <div className="absolute left-0 right-0 bottom-0 p-sp-3 text-white">
        <b className="block text-[13.5px] font-display">{item.name}</b>
        <span className="text-xs text-white/80">{item.meta}</span>
      </div>
    </Link>
  );
}

const STATS = [
  // Founded 1980 (see /about), so this has to track the founding year rather
  // than sit at a number that was already stale when it was written.
  {
    n: String(new Date().getFullYear() - 1980),
    l: "Years in Vancouver",
    accent: false,
  },
  { n: "18M+", l: "Garments printed", accent: true },
  { n: "2,800+", l: "Businesses served", accent: false },
  { n: "99.4%", l: "On-time delivery", accent: true },
];

export function StatsBand() {
  return (
    <section className="pt-sp-6 sm:pt-sp-8 pb-sp-4 sm:pb-sp-5">
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sp-3 text-center">
          {STATS.map((s) => (
            <div key={s.l} className="px-1">
              <div
                className={`font-display font-bold text-[clamp(26px,5vw,44px)] leading-none ${
                  s.accent ? "text-accent" : "text-text-primary"
                }`}
              >
                {s.n}
              </div>
              <div className="text-[11px] sm:text-[13px] text-text-tertiary mt-2 uppercase tracking-wide">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="pb-sp-6 sm:pb-sp-8 pt-sp-3">
      <Container>
        <div className="bg-accent text-white rounded-md px-sp-4 sm:px-sp-5 py-sp-4 sm:py-sp-5 flex flex-col md:flex-row md:flex-wrap justify-between items-start md:items-center gap-sp-4">
          <div className="min-w-0">
            <h3 className="text-white font-display font-bold text-[clamp(20px,2.4vw,28px)] max-w-[520px] m-0 text-balance">
              Ready to print something real?
            </h3>
            <p className="text-white/90 mt-1.5 mb-0 text-sm sm:text-base leading-relaxed max-w-[52ch]">
              Free digital proof, no setup fees on reorders, and a real person on
              every job.
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap w-full md:w-auto">
            <ButtonLink
              href="/design"
              variant="secondary"
              className="!bg-white !text-accent hover:!bg-white/90 border-transparent flex-1 sm:flex-none justify-center"
            >
              Start Designing
            </ButtonLink>
            {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
              <ButtonLink
                href="/quote"
                variant="secondary"
                className="border-white/60 !text-white hover:bg-white/15 hover:!border-white flex-1 sm:flex-none justify-center"
              >
                Get a Quote
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
