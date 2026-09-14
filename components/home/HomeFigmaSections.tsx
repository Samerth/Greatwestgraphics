"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/shared/Container";
import { BackgroundVideo } from "@/components/shared/BackgroundVideo";

/**
 * Figma "Idea to Delivery" (2107:317) — the statement band that now follows
 * the four "how to order" steps.
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

/* A "Quick Paths" trio lived here — I need uniforms / I need promo
   products / I have my own design — as the first section under the hero.
   Removed at the client's request (CodSphere UAT V2 row 63): the four
   "how to order" steps now occupy that slot instead, so the page opens by
   explaining the process rather than asking the visitor to self-classify.
   Its three destinations are all still reachable — /products from the nav
   and the four steps, /contact from the header, and the Design Studio from
   any product page. */
