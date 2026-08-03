"use client";

import Image, { ImageProps } from "next/image";

/**
 * Wrapper around Next.js Image that respects NEXT_PUBLIC_DISABLE_IMAGES env var.
 * Used in staging to avoid loading images for performance/bandwidth testing.
 */
export function OptionalImage(props: ImageProps) {
  const disableImages = process.env.NEXT_PUBLIC_DISABLE_IMAGES === "true";

  if (disableImages) {
    return (
      <div
        className="bg-gradient-to-br from-text-tertiary to-border flex items-center justify-center text-center text-sm text-text-secondary"
        style={{
          width: typeof props.width === "number" ? props.width : "auto",
          height: typeof props.height === "number" ? props.height : "auto",
        }}
      >
        <span className="opacity-50">[Image disabled]</span>
      </div>
    );
  }

  return <Image {...props} />;
}
