import type { CSSProperties } from "react";
import type { BackdropImageStyle } from "@/lib/commerce/garment-backdrop";

/**
 * CSS garment plate. A multiply wash tints photorealistic white side
 * plates to the selected colourway without cropping the front photo.
 */
export function GarmentBackdropImage({
  url,
  frame,
  image,
  tintHex,
}: {
  url: string;
  frame: CSSProperties;
  image: BackdropImageStyle;
  tintHex?: string;
}) {
  return (
    <div
      style={{
        ...frame,
        isolation: tintHex ? "isolate" : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- paint immediately; Konva still waits on the canvas URL */}
      <img src={url} alt="" style={image} />
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
