"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogImage } from "@/components/shared/CatalogImage";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type PdpGalleryImage = {
  label: string;
  url: string;
};

export function PdpImageGallery({
  images,
  alt,
}: {
  images: PdpGalleryImage[];
  alt: string;
}) {
  const usable = useMemo(
    () => images.filter((image) => Boolean(image.url)),
    [images],
  );
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Clamped rather than used raw: switching colourway can shorten the list
  // while `active` still points past the end.
  const activeIndex = Math.min(active, Math.max(usable.length - 1, 0));
  const current = usable[activeIndex];

  /** Move by one, wrapping at both ends. Shared by the arrows and the
   *  lightbox's keyboard handler so they can never disagree. */
  const step = useCallback(
    (delta: number) => {
      setActive((prev) => {
        const count = usable.length;
        if (count === 0) return 0;
        return (((prev + delta) % count) + count) % count;
      });
    },
    [usable.length],
  );

  // Esc closes the lightbox; left/right cycle through the other angles
  // without needing to close and reopen.
  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, step]);

  if (usable.length === 0) {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg-raised">
        <div className="absolute inset-0 bg-fill-subtle-15" />
      </div>
    );
  }

  return (
    <div className="space-y-sp-3">
      {/* The main image is itself a button (click to enlarge), so the cycle
          arrows sit beside it rather than inside it — a button nested in a
          button is invalid and the inner one stops receiving clicks. */}
      <div className="relative">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative aspect-square w-full rounded-lg overflow-hidden border border-border bg-bg-raised cursor-zoom-in"
        aria-label={`View full-screen image — ${alt}, ${current.label}`}
      >
        <div className="absolute inset-6 sm:inset-10">
          <CatalogImage
            src={current.url}
            alt={`${alt} — ${current.label}`}
            fill
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
        <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm bg-bg/90 border border-border">
          {current.label}
        </span>
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-sm bg-bg/90 border border-border opacity-0 transition-opacity group-hover:opacity-100">
          <span aria-hidden>⤢</span>
          Click to enlarge
        </span>
      </button>

      {/* Cycle arrows on the image itself. The thumbnails below already
          switch views, but they only work if the shopper realises they are
          controls — arrows are the pattern people expect on a product photo
          (Pavin, 10 Sep: "product images to have arrow to cycle through
          photos"). Always visible rather than hover-only, so they exist on
          touch devices too. */}
      {usable.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full border border-border bg-bg/90 text-text-primary shadow-sm hover:bg-bg hover:border-accent hover:text-accent transition-colors"
          >
            <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full border border-border bg-bg/90 text-text-primary shadow-sm hover:bg-bg hover:border-accent hover:text-accent transition-colors"
          >
            <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
          </button>
          <span className="absolute bottom-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-sm bg-bg/90 border border-border tabular-nums">
            {activeIndex + 1} / {usable.length}
          </span>
        </>
      )}
      </div>

      {usable.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {usable.map((image, index) => (
            <button
              key={`${image.label}-${image.url}`}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "relative w-20 h-20 rounded-md overflow-hidden border-2 bg-bg-raised transition-colors",
                index === activeIndex
                  ? "border-accent"
                  : "border-border hover:border-text-tertiary",
              )}
              aria-label={`Show ${image.label} view`}
              aria-pressed={index === activeIndex}
            >
              <CatalogImage
                src={image.url}
                alt=""
                fill
                className="object-contain p-1.5"
                sizes="80px"
              />
              <span className="absolute inset-x-0 bottom-0 bg-bg/90 text-[10px] font-bold uppercase tracking-wide py-0.5 text-center">
                {image.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/90 hover:text-white text-3xl leading-none z-10"
            aria-label="Close full-screen image"
          >
            ✕
          </button>

          {usable.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10 px-2"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10 px-2"
                aria-label="Next image"
              >
                ›
              </button>
            </>
          )}

          <div
            className="relative w-full h-full max-w-5xl max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <CatalogImage
              src={current.url}
              alt={`${alt} — ${current.label}`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-sm bg-bg/90 border border-border">
            {current.label}
          </span>
        </div>
      )}
    </div>
  );
}
