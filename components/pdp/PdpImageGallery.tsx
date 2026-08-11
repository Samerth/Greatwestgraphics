"use client";

import { useMemo, useState } from "react";
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
  const current = usable[Math.min(active, Math.max(usable.length - 1, 0))];

  if (usable.length === 0) {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg-raised">
        <div className="absolute inset-0 bg-fill-subtle-15" />
      </div>
    );
  }

  return (
    <div className="space-y-sp-3">
      <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg-raised">
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
    </div>
  );
}
