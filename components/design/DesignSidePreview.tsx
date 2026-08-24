import {
  DESIGN_CANVAS_SIZE,
  DESIGN_SIDE_LABELS,
  type DesignDocument,
  type DesignSide,
  type PlacedText,
} from "@gwg/contracts";
import { studioFontById } from "@/lib/commerce/studio-fonts";
import {
  estimateTextDisplaySize,
  studioTextArcSvgPath,
} from "@/lib/commerce/studio-text";
import {
  framedBackdropStyles,
  garmentBackdropForSide,
  type PhotoCrop,
} from "@/lib/commerce/garment-backdrop";

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
  garmentCrop,
  garmentPlate,
  size = DESIGN_CANVAS_SIZE,
  className,
}: {
  side: DesignSide;
  design: DesignDocument;
  garmentImageUrl?: string | null;
  mirrorGarment?: boolean;
  garmentCrop?: PhotoCrop;
  garmentPlate?: boolean;
  size?: number;
  className?: string;
}) {
  const artworks = design.artworksBySide[side] ?? [];
  const texts = design.textsBySide?.[side] ?? [];
  const fallback = garmentBackdropForSide(side, {});
  const imageUrl = garmentImageUrl || fallback.url;
  const mirrored = mirrorGarment ?? fallback.mirror;
  const crop = garmentCrop ?? (garmentImageUrl ? undefined : fallback.crop);
  const plate = garmentPlate ?? (garmentImageUrl ? undefined : fallback.plate);
  const framed = framedBackdropStyles({
    crop,
    mirror: Boolean(mirrored),
    plate,
  });

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
        <div style={framed.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            style={{
              ...framed.image,
              opacity: garmentImageUrl ? 1 : 0.9,
            }}
          />
        </div>

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
        {texts.map((layer) => (
          <PreviewText key={layer.id} layer={layer} />
        ))}
      </div>

      {artworks.length === 0 && texts.length === 0 && (
        <span
          className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-text-tertiary"
        >
          Nothing on the {DESIGN_SIDE_LABELS[side].toLowerCase()}
        </span>
      )}
    </div>
  );
}

function PreviewText({ layer }: { layer: PlacedText }) {
  const family = studioFontById(layer.fontFamily).family;
  const display = estimateTextDisplaySize(
    layer.text,
    layer.fontSize,
    layer.letterSpacing,
  );
  const arc = layer.arc ?? 0;
  const transform = `rotate(${layer.rotation}deg) scale(${layer.scaleX}, ${layer.scaleY})`;
  if (Math.abs(arc) < 1) {
    return (
      <div
        style={{
          position: "absolute",
          left: layer.x,
          top: layer.y,
          transformOrigin: "top left",
          transform,
          color: layer.fill,
          fontFamily: family,
          fontSize: layer.fontSize,
          letterSpacing: layer.letterSpacing,
          textAlign: layer.align,
          WebkitTextStroke: layer.outline
            ? `${layer.outlineWidth ?? 1}px ${layer.outlineColor ?? "#111"}`
            : undefined,
          whiteSpace: "pre",
          lineHeight: 1.1,
        }}
      >
        {layer.text}
      </div>
    );
  }
  const pathId = `preview-arc-${layer.id}`;
  return (
    <svg
      width={display.width}
      height={Math.max(display.height * 2, 40)}
      style={{
        position: "absolute",
        left: layer.x,
        top: layer.y,
        overflow: "visible",
        transformOrigin: "top left",
        transform,
      }}
    >
      <defs>
        <path id={pathId} d={studioTextArcSvgPath(display.width, arc)} fill="none" />
      </defs>
      <text
        fill={layer.fill}
        fontFamily={family}
        fontSize={layer.fontSize}
        letterSpacing={layer.letterSpacing}
      >
        <textPath href={`#${pathId}`}>{layer.text}</textPath>
      </text>
    </svg>
  );
}
