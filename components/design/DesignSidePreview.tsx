import {
  DESIGN_CANVAS_SIZE,
  DESIGN_SIDE_LABELS,
  type DesignDocument,
  type DesignSide,
} from "@gwg/contracts";

/**
 * A read-only rendering of one garment view, faithful to what the customer
 * placed in the studio.
 *
 * Artwork coordinates are stored in Konva's stage space: `x`/`y` are the
 * layer's top-left corner, the image draws at its natural pixel size, and
 * rotation and scale both pivot on that corner. Reproducing that in CSS is a
 * matter of matching the order Konva composes the transform in — translate,
 * then rotate, then scale — which `left`/`top` plus
 * `rotate() scale()` about a top-left origin does exactly.
 *
 * Doing it in plain CSS rather than a second Konva stage is what lets staff
 * pages render the customer's design on the server, with no canvas, no
 * client bundle and no chance of the two renderers drifting apart.
 */
export function DesignSidePreview({
  side,
  design,
  garmentImageUrl,
  mirrorGarment,
  size = DESIGN_CANVAS_SIZE,
  className,
}: {
  side: DesignSide;
  design: DesignDocument;
  garmentImageUrl?: string | null;
  mirrorGarment?: boolean;
  size?: number;
  className?: string;
}) {
  const artworks = design.artworksBySide[side] ?? [];
  // Back and right views reuse the front and left photos when the vendor
  // supplied nothing better, so they are flipped to at least face the right
  // way — the same fallback the studio itself draws.
  const mirrored = mirrorGarment ?? (side === "back" || side === "right");

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: DESIGN_CANVAS_SIZE,
          height: DESIGN_CANVAS_SIZE,
          transform: `scale(${size / DESIGN_CANVAS_SIZE})`,
          transformOrigin: "top left",
        }}
      >
        {garmentImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={garmentImageUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: mirrored ? "scaleX(-1)" : undefined,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/images/t-shirt.png"
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.18,
              transform: mirrored ? "scaleX(-1)" : undefined,
            }}
          />
        )}

        {artworks.map((artwork) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={artwork.id}
            src={artwork.src}
            alt={`${DESIGN_SIDE_LABELS[side]} artwork`}
            style={{
              position: "absolute",
              left: artwork.x,
              top: artwork.y,
              transformOrigin: "top left",
              transform: `rotate(${artwork.rotation}deg) scale(${artwork.scaleX}, ${artwork.scaleY})`,
              maxWidth: "none",
            }}
          />
        ))}
      </div>

      {artworks.length === 0 && (
        <span
          className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-text-tertiary"
        >
          Nothing on the {DESIGN_SIDE_LABELS[side].toLowerCase()}
        </span>
      )}
    </div>
  );
}
