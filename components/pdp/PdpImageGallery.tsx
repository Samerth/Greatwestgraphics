"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
  const current = usable[Math.min(active, Math.max(usable.length - 1, 0))];

  // Esc closes the lightbox; left/right cycle through the other angles
  // without needing to close and reopen.
  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") {
        setActive((prev) => (prev + 1) % usable.length);
      }
      if (e.key === "ArrowLeft") {
        setActive((prev) => (prev - 1 + usable.length) % usable.length);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, usable.length]);

  if (usable.length === 0) {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg-raised">
        <div className="absolute inset-0 bg-fill-subtle-15" />
      </div>
    );
  }

  return (
    <div className="space-y-sp-3">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative aspect-square w-full rounded-lg overflow-hidden border border-border bg-bg-raised cursor-zoom-in"
        aria-label={`View full-screen image — ${alt}, ${current.label}`}
      >
        <div className="absolute inset-6 sm:inset-10">
          <Image
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

      {usable.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {usable.map((image, index) => (
            <button
              key={`${image.label}-${image.url}`}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "relative w-20 h-20 rounded-md overflow-hidden border-2 bg-bg-raised transition-colors",
                index === active
                  ? "border-accent"
                  : "border-border hover:border-text-tertiary",
              )}
              aria-label={`Show ${image.label} view`}
              aria-pressed={index === active}
            >
              <Image
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
                  setActive((prev) => (prev - 1 + usable.length) % usable.length);
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
                  setActive((prev) => (prev + 1) % usable.length);
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
            <Image
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
