"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { X, Play, ChevronLeft, ChevronRight } from "lucide-react";

export type ShowcaseItem = {
  /** Short muted loop. Never preloaded — it is fetched on first hover/open. */
  videoSrc: string;
  /** Must be frame 0 of `videoSrc`, or the tile visibly jumps when it plays. */
  poster: string;
  name: string;
  meta: string;
  /** Alt text for the poster. Falls back to `name` when omitted. */
  alt?: string;
};

/**
 * The floor footage, as a grid of tiles that play on hover and open large on
 * click.
 *
 * Three things drive the implementation:
 *
 * - `preload="none"` on every tile. Seven clips sitting on the homepage would
 *   be indefensible if they all downloaded up front; nothing is fetched until
 *   a pointer actually lands on a tile, so the page still costs what the
 *   posters cost.
 * - Hover is treated as an enhancement, not the interface. Touch has no hover
 *   and `prefers-reduced-motion` opts out of it, so the play affordance is
 *   always visible and clicking is always the reliable path.
 * - The clips carry no audio track at all (stripped at encode), so the
 *   lightbox is "see it bigger" rather than a media player, and there is no
 *   mute control to get wrong.
 */
export function MediaShowcase({
  items,
  ctaHref,
  ctaLabel = "Start your design",
  className = "",
}: {
  items: ShowcaseItem[];
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div
        className={`grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-sp-3 ${className}`}
      >
        {items.map((item, i) => (
          <ShowcaseTile
            key={item.videoSrc}
            item={item}
            onOpen={() => setOpenIndex(i)}
          />
        ))}
      </div>

      {openIndex !== null && (
        <MediaLightbox
          items={items}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          ctaHref={ctaHref}
          ctaLabel={ctaLabel}
        />
      )}
    </>
  );
}

function ShowcaseTile({
  item,
  onOpen,
}: {
  item: ShowcaseItem;
  onOpen: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const start = useCallback(() => {
    if (reduceMotion) return;
    const el = videoRef.current;
    if (!el) return;
    // play() rejects when the browser declines autoplay. That is a normal
    // outcome, not an error — the poster simply stays put.
    el.play().then(() => setPlaying(true)).catch(() => {});
  }, [reduceMotion]);

  const stop = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={(e) => {
        // Coarse pointers report an enter on tap; that should open the
        // lightbox, not silently start playback behind the finger.
        if (e.pointerType === "mouse") start();
      }}
      onPointerLeave={stop}
      onFocus={start}
      onBlur={stop}
      aria-label={`${item.name} — ${item.meta}. Play larger.`}
      className="group relative block w-full aspect-[4/5] sm:aspect-[5/4] rounded-md overflow-hidden bg-fill-subtle-15 text-left"
    >
      <Image
        src={item.poster}
        alt={item.alt ?? item.name}
        fill
        className={`object-cover transition-[transform,opacity] duration-700 ease-out-custom group-hover:scale-[1.03] ${
          playing ? "opacity-0" : "opacity-100"
        }`}
        sizes="(max-width: 768px) 50vw, 33vw"
      />
      <video
        ref={videoRef}
        src={item.videoSrc}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden
        tabIndex={-1}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      />

      <span
        className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,rgba(0,0,0,.86)_100%)]"
        aria-hidden
      />

      {/* Always present so touch users get the same affordance as hover. */}
      <span
        aria-hidden
        className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full bg-black/45 text-white backdrop-blur-sm ring-1 ring-white/25 transition-[background-color,transform] duration-med ease-out-custom group-hover:bg-accent group-hover:scale-105"
      >
        <Play className="w-3.5 h-3.5 fill-current translate-x-px" />
      </span>

      <span className="absolute left-0 right-0 bottom-0 p-sp-3 text-white">
        <b className="block text-[13.5px] font-display">{item.name}</b>
        <span className="text-xs text-white/80">{item.meta}</span>
      </span>
    </button>
  );
}

/**
 * Exported so a single feature clip (the storefront band) can open the same
 * dialog as the grid without pretending to be a one-item grid.
 */
export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  ctaHref,
  ctaLabel,
}: {
  items: ShowcaseItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  ctaHref?: string;
  ctaLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const item = items[index];
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<Element | null>(null);

  const go = useCallback(
    (delta: number) => onIndexChange((index + delta + items.length) % items.length),
    [index, items.length, onIndexChange],
  );

  // Remember what had focus, move focus into the dialog, and put it back on
  // close — otherwise closing drops the caret at the top of the document.
  useEffect(() => {
    restoreTo.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, []);

  // The page behind must not scroll while the dialog owns the screen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight") return go(1);
      if (e.key === "ArrowLeft") return go(-1);
      if (e.key !== "Tab") return;
      // Minimal focus trap: keep Tab inside the dialog.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], video[controls]',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} — ${item.meta}`}
      // `bg-black/90`, not `/88`: 88 is not a step in Tailwind's opacity scale,
      // so the class was dropped silently and the backdrop computed to fully
      // transparent — white dialog text over the bright page behind it.
      className="fixed inset-0 z-[200] flex items-center justify-center p-sp-3 sm:p-sp-5 bg-black/90 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        data-surface="dark"
        className="relative w-full max-w-[min(1100px,92vw)]"
      >
        <div className="flex items-start justify-between gap-sp-3 mb-sp-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-white text-[clamp(1.05rem,2.4vw,1.5rem)] m-0">
              {item.name}
            </h3>
            <p className="text-white/70 text-sm m-0 mt-1">{item.meta}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 grid place-items-center w-10 h-10 rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            // Keyed so switching items remounts the element rather than
            // leaving the previous clip's frame on screen mid-swap.
            key={item.videoSrc}
            src={item.videoSrc}
            poster={item.poster}
            autoPlay={!reduceMotion}
            loop
            muted
            playsInline
            controls
            className="w-full max-h-[68vh] object-contain bg-black"
          />
        </div>

        <div className="flex items-center justify-between gap-sp-3 mt-sp-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous clip"
              className="grid place-items-center w-10 h-10 rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-sm tabular-nums">
              {index + 1} / {items.length}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next clip"
              className="grid place-items-center w-10 h-10 rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {ctaHref && (
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-text-primary hover:bg-white/90 transition-colors"
            >
              {ctaLabel} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
