"use client";

import { useState } from "react";
import type { DesignDocument, DesignSide } from "@gwg/contracts";
import { DesignSidePreview } from "@/components/design/DesignSidePreview";

/**
 * The saved design's rendered proof photo, falling back to a live re-render
 * of the actual artwork layers if the proof image fails to load — same
 * fallback the list already uses when there's no proofImageUrl at all, just
 * also triggered when the URL exists but the file behind it is gone (found
 * during a live admin audit: a handful of designs pointed at proof files no
 * longer in storage, and rendered as a broken-image icon instead). A missing
 * file should never be the thing a customer's design looks broken over,
 * since the actual artwork placement is still fully known from the design
 * document itself.
 */
export function DesignThumbnail({
  proofImageUrl,
  alt,
  side,
  design,
}: {
  proofImageUrl: string | null;
  alt: string;
  side: DesignSide;
  design: DesignDocument;
}) {
  const [proofFailed, setProofFailed] = useState(false);

  if (proofImageUrl && !proofFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={proofImageUrl}
        alt={alt}
        className="w-full h-full object-contain"
        onError={() => setProofFailed(true)}
      />
    );
  }

  return (
    <DesignSidePreview side={side} design={design} garmentImageUrl={null} size={200} />
  );
}
