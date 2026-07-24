"use client";

import { motion } from "framer-motion";

/**
 * Recolors instantly via CSS mask against a transparent PNG silhouette
 * (e.g. /images/t-shirt.png). Any garment PNG with alpha becomes
 * tintable to any hex at runtime — no server round-trip needed.
 */
export function RecolorGarment({
  maskSrc,
  color,
  className,
}: {
  maskSrc: string;
  color: string;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      animate={{ backgroundColor: color }}
      transition={{ duration: 0.4, ease: [0.16, 0.8, 0.3, 1] }}
      style={{
        WebkitMaskImage: `url(${maskSrc})`,
        maskImage: `url(${maskSrc})`,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
