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

  // The Konva layer that actually gets exported loads this same URL with
  // crossOrigin="anonymous" (needed for stage.toDataURL() to work at all on
  // a cross-origin garment photo). This plain preview — the CSS backdrop and
  // every always-visible side thumbnail — used to load it with no CORS mode.
  // Two different credentials modes racing for the same URL let the browser
  // cache serve its opaque (non-CORS) response back to the canvas's request,
  // silently tainting it: toDataURL() throws, seemingly at random, worst
  // right after a side had been sitting on screen as a thumbnail for a
  // while. Requesting it the same way here removes the mismatch instead of
  // just retrying past it.
  const sameOrigin =
    (src.startsWith("/") && !src.startsWith("//")) ||
    src.startsWith("data:") ||
    src.startsWith("blob:");

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
        crossOrigin={sameOrigin ? undefined : "anonymous"}
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
