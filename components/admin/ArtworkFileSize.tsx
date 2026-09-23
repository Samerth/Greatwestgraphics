"use client";

import { useEffect, useState } from "react";

/**
 * Reads one artwork file's natural pixel dimensions in the browser.
 *
 * The design document never stores this — only the placed scale, which is
 * relative to the print area, not the file's own size — so this is the
 * same measurement the Studio makes the moment a file is first placed
 * (`measureArtworkSize`), just made visible again here for staff reviewing
 * a saved design (UAT: "uploaded designs need to be... downloadable from
 * the image download when reviewing", read alongside its pixel size).
 */
export function ArtworkFileSize({ src }: { src: string }) {
  const [size, setSize] = useState<{ width: number; height: number } | "error" | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      if (!cancelled) setSize("error");
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (size === null) return <span className="text-text-tertiary">Measuring…</span>;
  if (size === "error") return <span className="text-text-tertiary">Size unavailable</span>;
  return (
    <span>
      {size.width.toLocaleString()} × {size.height.toLocaleString()} px
    </span>
  );
}
