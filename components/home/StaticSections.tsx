"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArtTile } from "@/components/shared/ArtTile";
import { ButtonLink } from "@/components/shared/Button";
import { Container } from "@/components/shared/Container";

const TRUST_LOGOS = [
  { name: "Marriott", src: "/images/marriott.png" },
  { name: "Fujitsu", src: "/images/fujitsu.png" },
  { name: "Grande West", src: "/images/grande_west.png" },
  { name: "Unity Collective", src: null },
  { name: "St. George's", src: null },
];

export function TrustStrip() {
  return (
    <section className="py-sp-7 text-center border-y border-border bg-bg-raised">
      <Container>
        <p className="font-bold text-text-secondary m-0 mb-sp-5">
          Trusted by enterprise, education, and hospitality brands.
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-sp-6 gap-y-sp-4">
          {TRUST_LOGOS.map((logo) =>
            logo.src ? (
              <div
                key={logo.name}
                className="relative h-10 w-[120px] opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
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
                className="font-display font-bold text-lg text-text-secondary opacity-70"
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
    <section className="py-sp-8" id="reviews">
      <Container>
        <h2 className="text-center font-display font-bold text-header m-0">
          What Our Clients Say
        </h2>
        <div className="mt-sp-2 mb-sp-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-text-secondary">
          <span>4.8/5 · 214 reviews</span>
          <Link href="/#reviews" className="font-bold text-accent hover:underline">
            See all reviews
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3">
          {TESTIMONIALS.map((t, index) => (
            <motion.article
              key={t.who}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
              className="bg-bg-raised border border-border rounded-md p-sp-4"
            >
              <div className="text-accent text-sm mb-sp-2" aria-hidden>
                ★★★★★
              </div>
              <p className="mb-sp-3 m-0 text-[15px] leading-relaxed">{t.text}</p>
              <div className="text-[13px] text-text-tertiary font-bold">{t.who}</div>
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
  artIndex: number;
  imageUrl?: string | null;
};

const FALLBACK_GALLERY: GalleryItem[] = [
  { name: "Marriott", meta: "Staff uniforms · embroidered", artIndex: 1 },
  { name: "Fujitsu", meta: "Corporate polos · branded", artIndex: 2 },
  { name: "St. George's School", meta: "Athletics hoodies · 3-colour", artIndex: 3 },
  { name: "Grande West", meta: "Crew tees · branded", artIndex: 4 },
  { name: "Local nonprofit", meta: "Canvas totes · benefit run", artIndex: 5 },
  { name: "Community event", meta: "Staff tees · rush order", artIndex: 6 },
  { name: "Trade & safety crew", meta: "Hi-vis hoodies · CSA", artIndex: 7 },
];

export function Gallery({ items = FALLBACK_GALLERY }: { items?: GalleryItem[] }) {
  const gallery = items.length > 0 ? items : FALLBACK_GALLERY;
  return (
    <section className="py-sp-8" id="gallery">
      <Container>
        <h2 className="text-center font-display font-bold text-header m-0 mb-sp-6">
          Real Work, Delivered
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sp-3">
          {gallery.slice(0, 4).map((g) => (
            <GalleryTile key={g.name} item={g} aspect="aspect-[308/280]" />
          ))}
        </div>
        <div className="mt-sp-3 grid grid-cols-1 md:grid-cols-3 gap-sp-3">
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
      href="/quote"
      className={`relative rounded-md overflow-hidden ${aspect} group block`}
    >
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.05]">
        <ArtTile
          artIndex={item.artIndex}
          imageSrc={item.imageUrl ?? undefined}
          alt={item.name}
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,.78)_100%)]" />
      <div className="absolute left-0 right-0 bottom-0 p-sp-3 text-white">
        <b className="block text-[13.5px] font-display">{item.name}</b>
        <span className="text-xs text-white/80">{item.meta}</span>
      </div>
    </Link>
  );
}

const STATS = [
  { n: "35", l: "Years in Vancouver", accent: false },
  { n: "18M+", l: "Garments printed", accent: true },
  { n: "2,800+", l: "Businesses served", accent: false },
  { n: "99.4%", l: "On-time delivery", accent: true },
];

export function StatsBand() {
  return (
    <section className="pt-sp-8 pb-sp-5">
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sp-3 text-center">
          {STATS.map((s) => (
            <div key={s.l}>
              <div
                className={`font-display font-bold text-[clamp(28px,4vw,44px)] ${
                  s.accent ? "text-accent" : ""
                }`}
              >
                {s.n}
              </div>
              <div className="text-[13px] text-text-tertiary mt-1 uppercase tracking-wide">
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
    <section className="pb-sp-8 pt-sp-3">
      <Container>
        <div className="bg-accent text-white rounded-md px-sp-5 py-sp-5 flex flex-wrap justify-between items-center gap-sp-4">
          <div>
            <h3 className="text-white font-display font-bold text-[clamp(20px,2.4vw,28px)] max-w-[520px] m-0">
              Ready to print something real?
            </h3>
            <p className="text-white/85 mt-1.5 mb-0 text-sm">
              Free digital proof, no setup fees on reorders, and a real person on
              every job.
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <ButtonLink
              href="/design"
              variant="secondary"
              className="!bg-white !text-accent hover:!bg-white/90 border-transparent"
            >
              Start Designing
            </ButtonLink>
            <ButtonLink
              href="/quote"
              variant="secondary"
              className="border-white/60 !text-white hover:bg-white/15 hover:!border-white"
            >
              Get a Quote
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
