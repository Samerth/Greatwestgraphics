"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
 *
 * LCP optimization: The poster image is painted first and the video playback
 * is deferred until the poster loads and the main thread is idle, ensuring
 * the poster (not the video) becomes the LCP element.
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
    <>
      {/* Poster image for LCP — priority + fetchPriority="high" for eager load */}
      <Image
        src={poster}
        alt=""
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        onLoad={() => setPosterLoaded(true)}
        aria-hidden
        className={`fill-media absolute inset-0 z-0 object-cover transition-opacity duration-300 ${className} ${
          videoReady && !reduceMotion ? "opacity-0" : "opacity-100"
        }`}
      />
      {/* Video deferred until poster paints and main thread is idle */}
      {!reduceMotion && (
        <video
          ref={videoRef}
          className={`fill-media absolute inset-0 z-0 transition-opacity duration-300 ${className} ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
          src={src}
          loop
          muted
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        />
      )}
    </>
  );
}
