"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

export function Hero() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  useEffect(() => {
    if (reduceMotion || !posterLoaded) return;
    const video = videoRef.current;
    if (!video) return;

    const startPlayback = () => {
      video.play().catch(() => {});
      setVideoReady(true);
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(startPlayback, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(startPlayback, 100);
      return () => clearTimeout(id);
    }
  }, [reduceMotion, posterLoaded]);

  return (
    <section className="relative min-h-[min(78svh,640px)] sm:min-h-[56vh] flex items-end overflow-hidden text-white">
      {/* Poster image for LCP — painted first and visible until video takes over */}
      <Image
        src="/images/hero-poster.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        onLoad={() => setPosterLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
          videoReady && !reduceMotion ? "opacity-0" : "opacity-100"
        }`}
      />
      {/* Video deferred until poster paints and main thread is idle */}
      {!reduceMotion && (
        <video
          ref={videoRef}
          src="/images/Hero.mp4"
          loop
          muted
          playsInline
          preload="none"
          className={`fill-media absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
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
          {/* Copy is verbatim from the UAT doc and stays that way — only the
              scale, weight and colour split change. Mockup's own hero
              measures 68px/760/-0.055em; this runs a size step smaller
              (clamp caps at 60px) because "Bring your brand to life." is a
              longer line than the mockup's "Your brand.", and the hero's
              height is itself capped by the UAT doc (the category grid must
              be visible near the bottom of the first viewport) — so this
              does not borrow the shared --fs-display token, which serves
              ordinary page headers with no such ceiling. "to life." takes
              the accent-on-dark colour, echoing the mockup's two-tone
              headline treatment ("Your brand." / "Made to be seen.") without
              inventing new words. */}
          <h1 className="font-display font-black text-[clamp(34px,7vw,60px)] leading-[1.03] tracking-[-0.03em] m-0 text-balance">
            Bring your brand{" "}
            <span className="text-accent-on-dark">to life.</span>
          </h1>
          <p className="mt-sp-3 mb-0 max-w-[46ch] text-white/90 text-base sm:text-[17px] leading-relaxed">
            Custom apparel, embroidery, screen printing and more — produced in
            Vancouver since 1980.
          </p>
          <div className="flex gap-3 mt-sp-4 flex-wrap">
            {/* SHOW_PUBLIC_QUOTE_CALCULATOR gates a separate, deliberately
                hidden live-pricing tool at /quote (see lib/features.ts) — not
                the button below. Keep both labelled "Request a Quote" only
                because they can never both render at once today; if that
                flag is ever flipped back on, rename one of them so a visitor
                doesn't see two identically-labelled buttons going to
                different places. */}
            {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
              <ButtonLink href="/quote" variant="primary">
                Request a Quote
              </ButtonLink>
            ) : null}
            {/* The two hero CTAs are both required by the UAT doc and their
                labels are fixed. What changed is only their relative weight:
                they used to render at near-identical visual strength (both
                carrying a white outline), so nothing signalled which was the
                main path. The primary is now a solid accent button and the
                secondary a solid white one (mockup treats its second CTA the
                same way — filled, not ghosted), rather than the previous
                ghost-on-dark outline. */}
            <ButtonLink
              href="/quote"
              variant={SHOW_PUBLIC_QUOTE_CALCULATOR ? "secondary" : "primary"}
              className="shadow-[0_2px_14px_rgba(0,0,0,0.35)]"
            >
              Get an Instant Quote
            </ButtonLink>
            {/* The client's "Request a Quote" ask — the existing, already-built
                SOW quote workflow, per the doc's own screenshot, is the
                /contact "Tell us what you're making" form, not the hidden
                calculator above. */}
            <ButtonLink
              href="/contact"
              variant="secondary"
              className="!bg-white !text-text-primary border-transparent hover:!bg-white/90"
            >
              Request a Quote
            </ButtonLink>
          </div>
          {/* This used to be a five-star glyph and "4.8/5 · Rated by Vancouver
              businesses". There is no reviews table and no review provider
              wired up, so the score and the stars were both invented. Until a
              real rating source exists, state the thing we can actually
              stand behind. Wording is unchanged — the mockup's own three
              checkmarked ticks are the model for the icons, not new copy. */}
          <div className="mt-sp-4 text-sm text-white/80 flex flex-wrap items-center gap-x-5 gap-y-2">
            {["Fast proofs", "Rush service available", "Canada-wide shipping"].map(
              (item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check size={15} strokeWidth={2.75} className="text-accent-on-dark shrink-0" />
                  {item}
                </span>
              ),
            )}
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
