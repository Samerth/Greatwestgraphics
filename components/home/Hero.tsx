"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative min-h-[min(100svh,820px)] sm:min-h-[78vh] flex items-end overflow-hidden text-white">
      <video
        src="/images/Hero.mp4"
        autoPlay={!reduceMotion}
        loop
        muted
        playsInline
        preload="metadata"
        poster="/images/hero-press.jpg"
        className="fill-media absolute inset-0 w-full h-full object-cover z-0"
      />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(0deg,rgba(13,13,13,.9)_0%,rgba(13,13,13,.4)_52%,rgba(13,13,13,.5)_100%)]" />

      <Container className="relative z-[2] w-full pb-sp-6 pt-[calc(var(--header-offset)+1.5rem)] sm:pb-sp-7 sm:pt-sp-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 0.8, 0.3, 1] }}
          className="max-w-[620px]"
        >
          <p className="m-0 mb-sp-3 font-bold text-[11px] sm:text-xs tracking-[0.16em] uppercase text-white/90">
            Vancouver · Est. 1980 · Screen Printing &amp; Embroidery
          </p>
          <h1 className="font-display font-bold text-display leading-display m-0 text-balance">
            Bring your brand <span className="text-white">to life.</span>
          </h1>
          <p className="mt-sp-3 mb-0 max-w-[46ch] text-white/90 text-base sm:text-[17px] leading-relaxed">
            Not a print website. A print studio. Ink, thread and four decades of
            getting it right, proofed before a single sheet runs.
          </p>
          <div className="flex gap-3 mt-sp-4 flex-wrap">
            <ButtonLink href="/quote" variant="primary">
              Get a Quote
            </ButtonLink>
            <ButtonLink
              href="/design"
              variant="secondary"
              className="border-white/50 text-white hover:border-white hover:bg-white/10"
            >
              Start Designing
            </ButtonLink>
          </div>
          {/* This used to be a five-star glyph and "4.8/5 · Rated by Vancouver
              businesses". There is no reviews table and no review provider
              wired up, so the score and the stars were both invented. Until a
              real rating source exists, state the thing we can actually
              stand behind. */}
          <div className="mt-sp-4 text-sm text-white/80 flex flex-wrap items-center gap-2">
            <span>
              Vancouver&rsquo;s print studio since 1980 &middot; proofed before
              every run
            </span>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
