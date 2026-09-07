"use client";

import { useReducedMotion } from "framer-motion";

/**
 * A silent, looping video used as section backdrop.
 *
 * Every background video on the site goes through here so they all behave the
 * same way: muted and inert to assistive tech, `preload="none"` so the clip
 * never competes with the page's own content for bandwidth, and — the part
 * that is easy to forget — the poster frame standing in on its own when the
 * visitor has asked for reduced motion, so the section still has an image
 * rather than collapsing to a flat colour.
 *
 * The poster should be a real frame from the clip. Pointing it at a different
 * image makes the section visibly jump the moment playback starts, which is
 * exactly the bug this component was written after finding on the homepage
 * hero (its poster was a photo from the login page).
 */
export function BackgroundVideo({
  src,
  poster,
  className = "",
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <video
      className={`fill-media absolute inset-0 z-0 ${className}`}
      src={src}
      poster={poster}
      autoPlay={!reduceMotion}
      loop
      muted
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
    />
  );
}
