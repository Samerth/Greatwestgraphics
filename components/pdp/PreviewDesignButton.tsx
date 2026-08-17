"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";

/**
 * The main garment → design hand-off on the PDP. Always visible (not
 * conditional on already having artwork in progress) — browse-then-design
 * is the primary flow, not an edge case, so this needs to be a real CTA a
 * first-time visitor sees, not a link that only appears once they've
 * already started designing elsewhere.
 */
export function PreviewDesignButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const design = useActiveDesignStore((s) => s.design);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasDesign = mounted && hasActiveArtwork(design);

  return (
    <Link href={`/design?garmentId=${encodeURIComponent(productId)}`} className={className}>
      {hasDesign ? "Continue my design on this garment" : "Add your logo or artwork to this"}
      {" →"}
    </Link>
  );
}
