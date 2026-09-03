"use client";

import { useState } from "react";

/**
 * The saved proof photo, or a plain note instead of a broken-image icon if
 * the file is gone (same class of issue DesignThumbnail guards against on
 * the designs list — found during a live admin audit).
 */
export function ProofImageOrNote({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="text-sm text-text-tertiary m-0">
        This design&apos;s saved proof image is no longer available in storage.
        The per-side previews above still reflect the actual artwork placement.
      </p>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="w-full object-contain" onError={() => setFailed(true)} />
  );
}
