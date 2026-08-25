"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  GARMENT_FALLBACK,
  type BackdropImageStyle,
} from "@/lib/commerce/garment-backdrop";

/**
 * CSS garment plate. A multiply wash tints photorealistic white side
 * plates to the selected colourway without cropping the front photo.
 */
export function GarmentBackdropImage({
  url,
  fallbackUrl = GARMENT_FALLBACK,
  frame,
  image,
  tintHex,
}: {
  url: string;
  fallbackUrl?: string;
  frame: CSSProperties;
  image: BackdropImageStyle;
  tintHex?: string;
}) {
  const [src, setSrc] = useState(url);

  useEffect(() => {
    setSrc(url);
  }, [url]);

  return (
    <div
      style={{
        ...frame,
        isolation: tintHex ? "isolate" : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- paint immediately; Konva still waits on the canvas URL */}
      <img
        src={src}
        alt=""
        style={image}
        onError={() => {
          setSrc((current) => {
            if (current === url && fallbackUrl && fallbackUrl !== url) {
              return fallbackUrl;
            }
            if (current !== GARMENT_FALLBACK) return GARMENT_FALLBACK;
            return current;
          });
        }}
      />
      {tintHex ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: tintHex,
            mixBlendMode: "multiply",
          }}
        />
      ) : null}
    </div>
  );
}
