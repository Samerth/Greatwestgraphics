"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

export function Hero() {
  return (
    <section className="relative min-h-[78vh] flex items-end overflow-hidden text-white">
      <video
        src="/images/Hero.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(0deg,rgba(13,13,13,.86),rgba(13,13,13,.35)_55%,rgba(13,13,13,.5))]" />

      <Container className="relative z-[2] pb-sp-7 pt-sp-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 0.8, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-white/85 mb-sp-3">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            Vancouver · Est. 1980 · Screen Printing &amp; Embroidery
          </div>
          <h1 className="font-display font-bold text-display leading-display max-w-[11ch]">
            Bring your brand <span className="text-white">to life.</span>
          </h1>
          <p className="mt-sp-3 max-w-[46ch] text-white/85 text-[17px] leading-[1.6]">
            Not a print website. A print studio. Ink, thread and 46 years of
            getting it right, proofed before a single sheet runs.
          </p>
          <div className="flex gap-sp-3 mt-sp-4 flex-wrap">
            <ButtonLink href="/#quote" variant="primary">
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
          <div className="mt-sp-4 text-[13px] text-white/75 flex items-center gap-2">
            <span className="text-accent brightness-150 saturate-150">★★★★★</span>
            4.8/5 · Rated by Vancouver businesses
          </div>
        </motion.div>
      </Container>
    </section>
  );
}