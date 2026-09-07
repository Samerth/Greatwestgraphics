"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/shared/Container";
import { BackgroundVideo } from "@/components/shared/BackgroundVideo";
import { publicQuoteOrFallback } from "@/lib/features";

/**
 * Figma "Idea to Delivery" (2107:317) — the statement band between the quick
 * paths and the trust strip.
 *
 * This was a headline floating on a CSS hive pattern: a full band of viewport
 * with nothing in it to look at, on a page whose whole subject is a physical
 * production floor. It now runs the shop's own press footage behind the
 * headline (`floor-press-loop.mp4`, an 8s silent loop cut from the Sept 5
 * drop — 831KB, so it costs roughly a quarter of what one product photo does).
 *
 * The supporting line is lifted from WalkTheFloor.tsx, which was written for
 * exactly this purpose and never wired into a page.
 */
export function IdeaToDelivery() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      data-surface="dark"
      // bg-band rather than a literal near-black: this is what's visible for
      // an instant before the video paints (and permanently, for anyone on
      // reduced motion whose poster hasn't loaded), so it should be the same
      // navy as every other dark section rather than a one-off black.
      className="relative overflow-hidden bg-band text-white py-[clamp(3.5rem,9vw,7rem)]"
    >
      <BackgroundVideo
        src="/images/floor-press-loop.mp4"
        poster="/images/gwg-press-rotary.jpg"
      />
      <div
        className="absolute inset-0 z-[1] bg-[linear-gradient(100deg,rgba(8,8,7,.94)_18%,rgba(8,8,7,.72)_52%,rgba(8,8,7,.42)_100%)]"
        aria-hidden
      />

      <Container className="relative z-[2] px-4">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: [0.16, 0.8, 0.3, 1] }}
          className="max-w-[30rem]"
        >
          <span className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent-on-dark mb-sp-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-on-dark" />
            Idea to Delivery
          </span>
          <h2 className="font-display font-bold text-[clamp(2rem,6vw,3.75rem)] leading-[1.05] m-0 tracking-tight text-balance">
            Made on <span className="text-accent-on-dark">this floor.</span>
          </h2>
          <p className="mt-sp-3 mb-0 text-white/75 text-[15px] sm:text-base leading-relaxed max-w-[42ch]">
            No stock photos, no “why choose us” cards. This is the press your
            order actually runs on — eight stations, Pantone-matched ink, cured
            to survive a hundred washes.
          </p>
        </motion.div>
      </Container>
    </section>
  );
}

const QUICK_PATHS = [
  {
    num: "01",
    title: "I need uniforms",
    body: "Kit out a team, crew or school. Bulk apparel, embroidered or printed, sized and sorted.",
    href: "/products",
  },
  {
    num: "02",
    title: "I need promo products",
    body: "Swag, giveaways and event gear. Pens to tote bags, branded and delivered on deadline.",
    // Pointed at "?category=promo", which is not a catalogue category — the
    // listing came back empty. We do not stock a promo line in the synced
    // catalogue, so sourcing these starts with a conversation.
    href: publicQuoteOrFallback("/contact"),
  },
  {
    num: "03",
    title: "I have my own design",
    body: "Upload artwork and go. We proof it, match your colours, and print it right the first time.",
    href: "/design",
  },
];

export function QuickPaths() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="section-pad">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3">
          {QUICK_PATHS.map((path, index) => (
            <motion.div
              key={path.num}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.45,
                delay: reduceMotion ? 0 : index * 0.08,
                ease: [0.16, 0.8, 0.3, 1],
              }}
            >
              <Link
                href={path.href}
                className="group block h-full bg-bg-raised border border-border rounded-lg p-sp-4 transition-[border-color,box-shadow,transform] duration-med ease-out-custom hover:border-accent hover:shadow-card hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-[2rem] justify-center text-xs font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-sm">
                    {path.num}
                  </span>
                  <span
                    className="text-text-tertiary group-hover:text-accent group-hover:translate-x-0.5 transition-[color,transform] duration-med ease-out-custom shrink-0"
                    aria-hidden
                  >
                    →
                  </span>
                </div>
                <h3 className="mt-sp-3 mb-1.5 text-lg font-display font-bold m-0 text-text-primary">
                  {path.title}
                </h3>
                <p className="text-sm sm:text-base text-text-secondary m-0 leading-relaxed">
                  {path.body}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
