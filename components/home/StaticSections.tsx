"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import { ButtonLink } from "@/components/shared/Button";
import { Container } from "@/components/shared/Container";
import {
  MediaShowcase,
  MediaLightbox,
  type ShowcaseItem,
} from "@/components/shared/MediaShowcase";
import { publicQuoteOrFallback, SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

/** `pad` trades tile padding for logo size: the wide, fine-print wordmarks
 * (Grande West, St. George's) were rendering at the same box as the chunky
 * Marriott mark, which left their type too small to read. Wordmarks get a
 * tighter inset so they fill the tile. */
const TRUST_LOGOS: {
  name: string;
  src: string;
  pad: "tight" | "normal";
}[] = [
  { name: "Marriott", src: "/images/marriott.png", pad: "normal" },
  { name: "Fujitsu", src: "/images/fujitsu.png", pad: "normal" },
  {
    name: "Grande West Transportation",
    src: "/images/grande_west.png",
    pad: "tight",
  },
  { name: "Unity Collective", src: "/images/company_logo.png", pad: "normal" },
  {
    name: "St. George's School",
    src: "/images/company_logo_2.png",
    pad: "tight",
  },
];

export function TrustStrip() {
  return (
    <section className="section-pad text-center border-y border-border bg-bg">
      <Container>
        <p className="font-bold text-text-secondary m-0 mb-sp-2 text-balance">
          Trusted by enterprise, education, and hospitality brands.
        </p>
        <p className="m-0 mb-sp-5 text-sm text-text-tertiary text-balance">
          Four decades of print and embroidery for teams across Metro Vancouver.
        </p>
        <ul className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-sp-3">
          {TRUST_LOGOS.map((logo) => (
            <li
              key={logo.name}
              // Logos read as placeholder boxes when every tile carries a hard
              // border at full strength. Softening the resting state and
              // bringing the logo to full opacity on hover lets the names
              // carry the section instead of the frames around them.
              className="group rounded-lg border border-border/60 bg-bg-raised h-[104px] sm:h-[120px] grid place-items-center transition-[border-color,box-shadow] duration-med ease-out-custom hover:border-border hover:shadow-card"
            >
              <div
                className={`relative w-full h-full ${
                  logo.pad === "tight"
                    ? "px-sp-2 py-sp-2 sm:px-sp-3"
                    : "px-sp-4 py-sp-4"
                }`}
              >
                <Image
                  src={logo.src}
                  alt={`${logo.name} logo`}
                  fill
                  className="object-contain opacity-80 transition-[transform,opacity] duration-med ease-out-custom group-hover:scale-[1.04] group-hover:opacity-100"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
                />
              </div>
              <span className="sr-only">{logo.name}</span>
            </li>
          ))}
        </ul>
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

/**
 * Footage of our own floor and finished work.
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
 *
 * Second pass: the replacement tiles were themselves stock/library imagery —
 * an ink shelf with a misspelled label, an embroidery macro of someone else's
 * machine, a model in a forest captioned "Large format banners". Every tile is
 * now a frame from GWG's own production footage, and each caption describes
 * what is literally in that frame.
 *
 * Known gap: the footage drop contains no embroidery, so the old "Thread
 * floor" tile has no honest replacement and is not shown. Worth asking
 * marketing for a short embroidery clip — it is a service we sell and the one
 * part of the floor this section can't currently evidence.
 *
 * Third pass: the stills became hover-play clips (see MediaShowcase). Each
 * tile's poster is frame 0 of its own loop and nothing is fetched until a
 * pointer lands on it, so the section gained motion without gaining weight.
 */
const GALLERY: ShowcaseItem[] = [
  {
    name: "On the press",
    meta: "Direct-to-garment · our own run, printed in house",
    videoSrc: "/images/tile-dtg.mp4",
    poster: "/images/tile-dtg-poster.jpg",
    alt: "Great West Graphics shirts being printed on the direct-to-garment press",
  },
  {
    name: "The main press",
    meta: "Eight stations · one colour at each",
    videoSrc: "/images/tile-rotary.mp4",
    poster: "/images/tile-rotary-poster.jpg",
    alt: "The eight-station rotary screen printing press",
  },
  {
    name: "Specialty ink",
    meta: "Metallics and glitter, pulled on the press",
    videoSrc: "/images/tile-ink-pull.mp4",
    poster: "/images/tile-ink-pull-poster.jpg",
    alt: "Metallic ink being pulled across a screen with a squeegee",
  },
  {
    name: "Ink room",
    meta: "Mixed and dispensed to spec",
    videoSrc: "/images/tile-ink-room.mp4",
    poster: "/images/tile-ink-room-poster.jpg",
    alt: "Ink being dispensed onto a screen on the press",
  },
  {
    name: "The floor",
    meta: "Every run loaded and checked by hand",
    videoSrc: "/images/tile-floor.mp4",
    poster: "/images/tile-floor-poster.jpg",
    alt: "A press operator loading a garment onto the press",
  },
  {
    name: "Lined up",
    meta: "Registered on the platen before the first pull",
    videoSrc: "/images/tile-registered.mp4",
    poster: "/images/tile-registered-poster.jpg",
    alt: "A garment registered on the platen under laser alignment lines",
  },
];

export function Gallery({ items = GALLERY }: { items?: ShowcaseItem[] }) {
  const gallery = items.length > 0 ? items : GALLERY;
  return (
    <section className="section-pad scroll-section" id="gallery">
      <Container>
        <div className="text-center mb-sp-5 sm:mb-sp-6">
          <h2 className="font-display font-bold text-header m-0 text-balance">
            Real Work, Delivered
          </h2>
          <p className="text-text-secondary text-sm sm:text-base mt-sp-2 mb-0">
            Filmed on our own floor. Hover any tile to watch it run — click to
            open it full size.
          </p>
        </div>
        <MediaShowcase items={gallery} ctaHref={publicQuoteOrFallback("/design")} />
      </Container>
    </section>
  );
}

/**
 * A real photograph of the actual building, with the address as selectable
 * HTML rather than burned into an image.
 *
 * The shop's street address previously appeared only as a line in the footer.
 * For a corporate buyer weighing an in-house printer against a broker, showing
 * the premises is worth more than another claim about quality.
 *
 * The source clip has a lower-third caption baked into the edit, so this still
 * is cropped above it. If marketing sends a clean export it is a one-file swap.
 */
const VISIT_FACTS = [
  { label: "Address", value: "#105 – 342 East Kent Ave S", sub: "Vancouver, BC V5X 4N6" },
  { label: "Hours", value: "Mon–Fri, 8:30am – 4:30pm", sub: "Pacific time" },
  { label: "Phone", value: "(604) 321-3285", href: "tel:+16043213285" },
];

export function VisitShop() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const start = () => {
    if (reduceMotion) return;
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
  };
  const stop = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  };

  return (
    // Full-bleed and dark, so it reads as its own moment rather than a seventh
    // gallery tile. Tucking it tight under the grid removed the dead whitespace
    // but cost the section all of its standing. Was `bg-[#0D0D0D]` — now the
    // same navy as the top bar and footer, which is the mockup's own pattern
    // for exactly this kind of "trust" band.
    <section data-surface="dark" className="bg-band text-white section-pad">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-sp-5 lg:gap-sp-6 items-center">
          <div>
            <span className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent-on-dark mb-sp-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-on-dark" />
              Visit the shop
            </span>
            <h2 className="font-display font-bold text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.08] text-white m-0 text-balance">
              Visit our shop.
            </h2>
            <p className="text-white/70 text-sm sm:text-base mt-sp-3 mb-sp-5 max-w-[46ch] leading-relaxed">
              Everything on this page is printed in this building. Walk in for
              proofs, pickup, or to watch a sample come off the press.
            </p>

            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-sp-3 m-0 mb-sp-5">
              {VISIT_FACTS.map((f) => (
                <div key={f.label}>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45 m-0">
                    {f.label}
                  </dt>
                  <dd className="m-0 mt-1.5 text-sm text-white">
                    {f.href ? (
                      <a href={f.href} className="hover:text-accent-on-dark transition-colors">
                        {f.value}
                      </a>
                    ) : (
                      f.value
                    )}
                    {f.sub && (
                      <span className="block text-white/55">{f.sub}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <ButtonLink
              href="https://www.google.com/maps/search/?api=1&query=342+East+Kent+Ave+S+Vancouver+BC"
              variant="secondary"
              target="_blank"
              className="!bg-white !text-text-primary border-transparent hover:!bg-white/90"
            >
              Get directions
            </ButtonLink>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(true)}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") start();
            }}
            onPointerLeave={stop}
            onFocus={start}
            onBlur={stop}
            aria-label="Play a clip of the Great West Graphics storefront, full size"
            className="group relative block w-full aspect-[16/10] rounded-lg overflow-hidden bg-white/5"
          >
            <Image
              src="/images/tile-storefront-poster.jpg"
              alt="The Great West Graphics building on East Kent Avenue South in Vancouver"
              fill
              // The source frame is far wider than this band, so a centred crop
              // cuts the roofline sign in half. Biasing upward keeps the
              // storefront signage — the whole point of the photo — in frame.
              className={`object-cover object-[center_32%] transition-opacity duration-300 ${
                playing ? "opacity-0" : "opacity-100"
              }`}
              sizes="(max-width: 1024px) 100vw, 620px"
            />
            <video
              ref={videoRef}
              src="/images/tile-storefront.mp4"
              muted
              loop
              playsInline
              preload="none"
              aria-hidden
              tabIndex={-1}
              className={`absolute inset-0 w-full h-full object-cover object-[center_32%] transition-opacity duration-300 ${
                playing ? "opacity-100" : "opacity-0"
              }`}
            />
            <span
              aria-hidden
              className="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full bg-black/45 text-white backdrop-blur-sm ring-1 ring-white/25 transition-[background-color,transform] duration-med ease-out-custom group-hover:bg-accent group-hover:scale-105"
            >
              <Play className="w-4 h-4 fill-current translate-x-px" />
            </span>
          </button>
        </div>
      </Container>

      {expanded && (
        <MediaLightbox
          items={[
            {
              name: "342 East Kent Ave S",
              meta: "Vancouver, BC · walk in for proofs and pickup",
              videoSrc: "/images/tile-storefront.mp4",
              poster: "/images/tile-storefront-poster.jpg",
            },
          ]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setExpanded(false)}
          ctaLabel="Get in touch"
          ctaHref="/contact"
        />
      )}
    </section>
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

/**
 * Counts a stat up from zero the first time it scrolls into view.
 *
 * The displayed strings carry their own formatting ("18M+", "2,800+",
 * "99.4%"), so the numeric part is animated and the prefix/suffix are put back
 * verbatim — the rendered value is never invented, only revealed. Anyone with
 * reduced motion enabled gets the final number immediately, and the real value
 * is always in the DOM for screen readers and for a failed hydration.
 */
function CountUpStat({ value }: { value: string }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!inView || reduceMotion) return;

    // Parsed inside the effect, not above it. `String.match` returns a fresh
    // array on every render, so passing it as a dependency re-ran this effect
    // on each render — the cleanup cancelled the pending frame and the next
    // run reset `start` to now, leaving the counter stuck a frame or two from
    // zero. The band rendered "1 years in Vancouver" and "78+ businesses
    // served" instead of the real 46 and 2,800+.
    const match = value.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) return;
    const [, prefix, digits, suffix] = match;
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    const grouped = digits.includes(",");
    const target = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(target)) return;

    const format = (n: number) =>
      grouped
        ? n.toLocaleString("en-CA", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : n.toFixed(decimals);

    let frame = 0;
    const start = performance.now();
    const DURATION = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      if (t >= 1) {
        // Land on the literal string rather than a re-formatted number, so the
        // final frame is always exactly the value that was passed in.
        setShown(value);
        return;
      }
      // ease-out cubic: fast first, settles on the real number
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(`${prefix}${format(target * eased)}${suffix}`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduceMotion, value]);

  return (
    <span ref={ref}>
      {shown ?? value}
    </span>
  );
}

export function StatsBand() {
  return (
    <section className="pt-sp-6 sm:pt-sp-8 pb-sp-4 sm:pb-sp-5">
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sp-3 text-center">
          {STATS.map((s) => (
            <div key={s.l} className="px-1">
              <div
                className={`font-display font-bold text-[clamp(26px,5vw,44px)] leading-none tabular-nums ${
                  s.accent ? "text-accent" : "text-text-primary"
                }`}
              >
                <CountUpStat value={s.n} />
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
