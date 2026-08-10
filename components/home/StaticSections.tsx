import Link from "next/link";
import { ArtTile } from "@/components/shared/ArtTile";
import { ButtonLink } from "@/components/shared/Button";

const TRUST_NAMES = ["Marriott", "Fujitsu", "Grande West", "Unity Collective", "St. George's"];

export function TrustStrip() {
  return (
    <section className="py-sp-8 text-center">
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24">
        <p className="font-bold text-text-secondary mb-sp-5">
          Trusted by enterprise, education, and hospitality brands.
        </p>
        <div className="flex flex-wrap justify-center items-center gap-sp-6 opacity-70">
          {TRUST_NAMES.map((n) => (
            <span key={n} className="font-display font-bold text-lg text-text-secondary">
              {n}
            </span>
          ))}
        </div>
      </div>
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
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24">
        <h2 className="text-center font-display font-bold text-header mb-sp-2">
          What Our Clients Say
        </h2>
        <p className="text-center text-sm text-text-secondary mb-sp-6">
          4.8/5 · 214 reviews
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.who}
              className="bg-fill-subtle-15 border border-border rounded-lg p-sp-4"
            >
              <div className="text-accent text-sm mb-sp-2">★★★★★</div>
              <p className="mb-sp-2">{t.text}</p>
              <div className="text-[13px] text-text-tertiary font-bold">{t.who}</div>
            </div>
          ))}
        </div>
      </div>
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
  { name: "SFU Athletics", meta: "240 hoodies · 3-colour", artIndex: 6 },
  { name: "North Van Fire", meta: "Embroidered polos", artIndex: 2 },
  { name: "Kettle Society", meta: "Canvas totes · benefit run", artIndex: 4 },
  { name: "PNE Fair", meta: "Staff tees · 1,200 pcs", artIndex: 3 },
  { name: "Whistler Trades", meta: "Hi-vis hoodies · CSA", artIndex: 5 },
  { name: "UBC Sciences", meta: "Grad hoodies · embroidered", artIndex: 1 },
  { name: "Coast Mountain", meta: "Uniform run · repeat", artIndex: 9 },
  { name: "Vancouver Trades", meta: "Crew tees · 48hr rush", artIndex: 7 },
];

export function Gallery({ items = FALLBACK_GALLERY }: { items?: GalleryItem[] }) {
  const GALLERY = items.length > 0 ? items : FALLBACK_GALLERY;
  return (
    <section className="py-sp-8 bg-fill-subtle-15" id="gallery">
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24">
        <div className="text-center max-w-none mb-sp-6">
          <h2 className="font-display font-bold text-header">
            Real Work, Delivered
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sp-3">
          {GALLERY.slice(0, 4).map((g) => (
            <Link
              key={g.name}
              href="/quote"
              className="relative rounded-lg overflow-hidden aspect-[308/280] group block"
            >
              <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.06]">
                <ArtTile artIndex={g.artIndex} imageSrc={g.imageUrl ?? undefined} alt={g.name} />
              </div>
              <div className="absolute left-0 right-0 bottom-0 p-sp-3 bg-[linear-gradient(0deg,rgba(0,0,0,.75),transparent)] text-white">
                <b className="block text-[13.5px]">{g.name}</b>
                <span className="text-xs text-white/80">{g.meta}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-sp-3 grid grid-cols-1 md:grid-cols-3 gap-sp-3">
          {GALLERY.slice(4, 7).map((g) => (
            <Link
              key={g.name}
              href="/quote"
              className="relative rounded-lg overflow-hidden aspect-[416/280] group block"
            >
              <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.06]">
                <ArtTile artIndex={g.artIndex} imageSrc={g.imageUrl ?? undefined} alt={g.name} />
              </div>
              <div className="absolute left-0 right-0 bottom-0 p-sp-3 bg-[linear-gradient(0deg,rgba(0,0,0,.75),transparent)] text-white">
                <b className="block text-[13.5px]">{g.name}</b>
                <span className="text-xs text-white/80">{g.meta}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
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
    <section className="pt-sp-8">
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24">
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
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="py-sp-8">
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24">
        <div className="bg-accent text-white rounded-lg px-sp-5 py-sp-5 flex flex-wrap justify-between items-center gap-sp-4">
          <div>
            <h3 className="text-white font-display font-bold text-[clamp(20px,2.4vw,28px)] max-w-[520px]">
              Ready to print something real?
            </h3>
            <p className="text-white/85 mt-1.5 text-sm">
              Free digital proof, no setup fees on reorders, and a real person on every job.
            </p>
          </div>
          <div className="flex gap-2.5">
            <ButtonLink
              href="/design"
              variant="secondary"
              className="!bg-white !text-accent hover:!bg-white/90 border-transparent"
            >
              Start Designing
            </ButtonLink>
            <ButtonLink
              href="/#quote"
              variant="secondary"
              className="border-white/60 !text-white hover:bg-white/15 hover:!border-white"
            >
              Get a Quote
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
