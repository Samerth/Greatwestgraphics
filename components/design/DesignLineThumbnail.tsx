"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DesignDocument } from "@gwg/contracts";
import { designSnapshotHeroSide } from "@/lib/commerce/design-line-snapshot";
import { garmentBackdropForSide, type GarmentPhotoSet } from "@/lib/commerce/garment-backdrop";
import { DesignSidePreview } from "@/components/design/DesignSidePreview";

/**
 * A per-colour rendering of a decorated order line — the design's own
 * layout, redrawn on THIS line's own garment photo, instead of the single
 * flattened picture every colour used to share (Pavin, client meeting:
 * "multiple colours of same product show only the same original colour
 * design — try to show same design on different colour").
 *
 * `DesignSidePreview` already exists for exactly this: a plain-CSS, faithful
 * reproduction of one garment view, built (per its own comment) so a page
 * with no canvas can render the customer's design. This component is the
 * thumbnail-sized wrapper around it — sized to cover its own container the
 * way `next/image`'s `fill` + `object-cover` would, since `DesignSidePreview`
 * only takes one fixed pixel size: the container is measured with a
 * `ResizeObserver`, and a square big enough to cover the larger of its two
 * dimensions is centred inside it and clipped by the container's own
 * `overflow-hidden` (every caller already sets that).
 *
 * `fallback` renders instead, unchanged, whenever there isn't enough to draw
 * a real preview from — an order placed before this existed, a design still
 * mid-upload, or a names/numbers-only roster line, which this does not draw
 * (see `designSnapshotHeroSide`) because the flattened proof already does.
 */
export function DesignLineThumbnail({
  design,
  garmentPhotos,
  fallback,
  className,
}: {
  design?: DesignDocument;
  garmentPhotos?: GarmentPhotoSet;
  fallback: ReactNode;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(112);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () =>
      setSize(Math.max(1, Math.round(Math.max(el.clientWidth, el.clientHeight))));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heroSide = design ? designSnapshotHeroSide(design) : null;
  const backdrop =
    heroSide && garmentPhotos ? garmentBackdropForSide(heroSide, garmentPhotos) : null;

  return (
    <div ref={boxRef} className={className}>
      {design && heroSide && backdrop ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <DesignSidePreview
            side={heroSide}
            design={design}
            garmentImageUrl={backdrop.url}
            mirrorGarment={backdrop.mirror}
            garmentCrop={backdrop.crop}
            garmentPlate={backdrop.plate}
            size={size}
          />
        </div>
      ) : (
        fallback
      )}
    </div>
  );
}
