"use client";

import { useEffect, useRef, useState } from "react";
// This file must only ever be loaded client-side via next/dynamic(..., { ssr:
// false }) in DesignStudio.tsx, and Stage/Layer must be plain (non-lazy)
// imports here. react-konva's custom reconciler calls flushSync internally
// on stage updates; if Stage/Layer are themselves React.lazy-wrapped (e.g.
// via next/dynamic), that synchronous flush can fire before the lazy import
// resolves, outside any Suspense boundary, throwing "Element type is
// invalid... Lazy element type must resolve to a class or function." Lazy-
// loading the whole canvas as one unit (this file) avoids that entirely.
import {
  Group,
  Image as KonvaImage,
  Stage,
  Layer,
  Text as KonvaText,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import type { DesignSide, PlacedArtwork, PlacedText } from "@gwg/contracts";
import { ArtworkLayer } from "@/components/design/ArtworkLayer";
import { TextLayer } from "@/components/design/TextLayer";
import {
  SLEEVE_PLATE_INSET,
  cropPixels,
  plateContainRect,
  type PhotoCrop,
} from "@/lib/commerce/garment-backdrop";
import { STUDIO_PRINT_AREAS } from "@/lib/commerce/studio-placement";

/** A resize handle could previously grow artwork up to the full canvas —
 * technically bounded, but "bounded by the whole stage" let a corner drag
 * balloon a logo past the garment entirely (CodSphere UAT: "artwork becomes
 * excessively enlarged during editing"). Cap it to a generous multiple of
 * the side's actual print area instead, so "oversized" still means
 * oversized-for-the-shirt, not "bigger than the canvas itself". */
const MAX_ARTWORK_PRINT_AREA_MULTIPLE = 1.6;

function maxArtworkDisplaySize(side: string, displaySize: number): number {
  const area = STUDIO_PRINT_AREAS[side as DesignSide];
  const fraction = area ? Math.max(area.width, area.height) : 0.4;
  return displaySize * fraction * MAX_ARTWORK_PRINT_AREA_MULTIPLE;
}

/**
 * Real rendered width of a roster placeholder mark, in the same logical
 * canvas units everything else here is measured in.
 *
 * A 2D canvas context's `measureText` is the browser's own text-shaping
 * engine — the same one Konva's Text ultimately draws with — so this stays
 * accurate for any string without hand-maintaining per-character widths.
 * Falls back to a rough estimate only if canvas is unavailable (should not
 * happen in the browser-only context this file already requires), so a
 * missing measurement degrades to "slightly wrong hit box" rather than a
 * crash.
 */
let measureCtx: CanvasRenderingContext2D | null | undefined;
function measureRosterMarkWidth(text: string, fontSize: number): number {
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return text.length * fontSize * 0.6;
  measureCtx.font = `bold ${fontSize}px Arial, sans-serif`;
  return Math.max(1, measureCtx.measureText(text).width);
}

/** Minimum rendered mark height, in canvas px, a resize handle can shrink
 *  to — mirrors `RosterDecorPartSchema`'s 0.25" floor closely enough that a
 *  drag basically never gets clamped away entirely by the transformer
 *  before the caller's own inch-based clamp even runs. */
const MIN_ROSTER_MARK_HEIGHT_PX = 8;

/**
 * One draggable, resizable "EXAMPLE" / "00" placeholder.
 *
 * Its own component — not inlined in a `.map` — because the Transformer
 * bind (below) needs a ref per mark, and hooks cannot live inside a loop
 * callback. Mirrors `ArtworkLayer`'s selected/img-gated Transformer pattern
 * exactly, including the non-finite guard: that guard exists because a
 * transform racing an unmeasured shape once corrupted a design permanently
 * with no way back but delete-and-redo, and text has the same race (its
 * width is computed from a canvas measurement, not available render 0).
 */
function RosterMarkNode({
  mark,
  canvasSize,
  isSelected,
  draggable,
  resizable,
  onSelect,
  onDragEnd,
  onResizeEnd,
}: {
  mark: {
    target: "names" | "numbers";
    text: string;
    centerX: number;
    centerY: number;
    fontSize: number;
    color: string;
    halo: string;
    renderOffsetY?: number;
  };
  canvasSize: number;
  isSelected: boolean;
  draggable: boolean;
  resizable: boolean;
  onSelect?: () => void;
  onDragEnd?: (droppedX: number, droppedY: number) => void;
  onResizeEnd?: (renderedHeightPx: number, centerX: number, centerY: number) => void;
}) {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const textWidth = measureRosterMarkWidth(mark.text, mark.fontSize);
  const renderOffsetY = mark.renderOffsetY ?? 0;

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaText
        ref={shapeRef}
        text={mark.text}
        x={mark.centerX - textWidth / 2}
        y={mark.centerY - mark.fontSize / 2 + renderOffsetY}
        width={textWidth}
        fontFamily="Arial"
        fontSize={mark.fontSize}
        fontStyle="bold"
        fill={mark.color}
        stroke={mark.halo}
        strokeWidth={Math.max(1, mark.fontSize * 0.035)}
        fillAfterStrokeEnabled
        opacity={0.9}
        perfectDrawEnabled={false}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        // A generous safety net only — keeps a wild drag from stranding the
        // node far off-stage where it would be hard to recover. The real,
        // per-location clamp (a fraction of that plate's own size) is
        // applied by the caller after drop, via the same limit
        // `rosterPreviewPlacement` enforces.
        dragBoundFunc={(pos) => ({
          x: Math.max(-canvasSize, Math.min(canvasSize * 2, pos.x)),
          y: Math.max(-canvasSize, Math.min(canvasSize * 2, pos.y)),
        })}
        onMouseEnter={(e) => {
          if (!draggable) return;
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "grab";
        }}
        onMouseLeave={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "default";
        }}
        onDragStart={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "grabbing";
        }}
        onDragEnd={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "grab";
          const droppedX = e.target.x() + textWidth / 2;
          const droppedY = e.target.y() + mark.fontSize / 2 - renderOffsetY;
          if (!Number.isFinite(droppedX) || !Number.isFinite(droppedY)) {
            console.error("[design-studio] ignored a non-finite roster drag", {
              target: mark.target,
              droppedX,
              droppedY,
            });
            return;
          }
          onDragEnd?.(droppedX, droppedY);
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          const renderedHeightPx = node.height() * Math.abs(node.scaleY());
          const centerX = node.x() + node.width() * node.scaleX() * 0.5;
          const centerY = node.y() + renderedHeightPx * 0.5 - renderOffsetY;
          // Same corruption path ArtworkLayer already guards: a transform on
          // a not-yet-measured node divides by zero and produces NaN, which
          // must never reach the saved design.
          if (
            ![renderedHeightPx, centerX, centerY].every(Number.isFinite)
          ) {
            console.error("[design-studio] ignored a non-finite roster resize", {
              target: mark.target,
              renderedHeightPx,
              centerX,
              centerY,
            });
            return;
          }
          // Reset the node's own scale to 1 immediately: fontSize (driven
          // by the caller's next `heightIn`) becomes the new source of
          // truth on the next render, rather than compounding a lingering
          // Konva-internal scale on top of it.
          node.scaleX(1);
          node.scaleY(1);
          onResizeEnd?.(renderedHeightPx, centerX, centerY);
        }}
      />
      {isSelected && resizable && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          // Corners only, and always uniform: dragging a text mark
          // non-uniformly (an edge handle, or free aspect) would stretch
          // the glyphs into a shape that could never actually be printed —
          // the one real control here is "how big", not "how squashed".
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          keepRatio
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < MIN_ROSTER_MARK_HEIGHT_PX ||
            newBox.height < MIN_ROSTER_MARK_HEIGHT_PX
              ? oldBox
              : newBox
          }
        />
      )}
    </>
  );
}

function GarmentLayer({
  src,
  canvasSize,
  mirrored,
  crop,
  plate,
  tintHex,
}: {
  src: string;
  canvasSize: number;
  mirrored: boolean;
  crop?: PhotoCrop;
  plate?: boolean;
  tintHex?: string;
}) {
  // Same-origin URLs (/_next/image, /api/uploads) must not request CORS.
  // Next's optimizer does not send Access-Control-Allow-Origin, so
  // crossOrigin=anonymous makes the garment fail to paint and the canvas
  // reads as a black box. Same-origin pixels are already readable for proofs.
  const sameOrigin =
    (src.startsWith("/") && !src.startsWith("//")) ||
    src.startsWith("data:") ||
    src.startsWith("blob:");
  const [image] = useImage(src, sameOrigin ? undefined : "anonymous");
  const [tinted, setTinted] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!image || !tintHex) {
      setTinted(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tintHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTinted(canvas);
  }, [image, tintHex]);

  const painted = tintHex ? tinted : image;
  if (!image || !painted) return null;

  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const source = crop
    ? cropPixels(crop, naturalWidth, naturalHeight)
    : {
        x: 0,
        y: 0,
        width: naturalWidth,
        height: naturalHeight,
      };
  const sourceAspect = naturalWidth / naturalHeight;
  const box = plateContainRect(
    crop,
    sourceAspect,
    plate ? SLEEVE_PLATE_INSET : 0,
  );
  const width = box.width * canvasSize;
  const height = box.height * canvasSize;
  const x = box.x * canvasSize;
  const y = box.y * canvasSize;

  return (
    <KonvaImage
      image={painted}
      crop={crop ? source : undefined}
      x={mirrored ? x + width : x}
      y={y}
      width={width}
      height={height}
      scaleX={mirrored ? -1 : 1}
      listening={false}
      name="garment"
    />
  );
}

export type StudioDragInfo = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function DesignCanvas({
  activeSide,
  artworks,
  texts = [],
  selectedId,
  canvasSize,
  zoom = 1,
  garmentImageUrl,
  mirrorGarment,
  garmentCrop,
  garmentPlate,
  garmentTintHex,
  stageRef,
  onSelect,
  onChangeArtwork,
  onChangeText,
  onDragMove,
  rosterPreview,
  selectedRosterTarget,
  onSelectRosterMark,
  onRosterPreviewDragEnd,
  onRosterPreviewResizeEnd,
}: {
  activeSide: string;
  artworks: PlacedArtwork[];
  texts?: PlacedText[];
  selectedId: string | null;
  canvasSize: number;
  zoom?: number;
  garmentImageUrl: string;
  mirrorGarment: boolean;
  garmentCrop?: PhotoCrop;
  garmentPlate?: boolean;
  garmentTintHex?: string;
  stageRef: React.RefObject<any>;
  onSelect: (id: string | null) => void;
  onChangeArtwork: (next: PlacedArtwork) => void;
  onChangeText: (next: PlacedText) => void;
  onDragMove?: (info: StudioDragInfo) => void;
  /**
   * "EXAMPLE / 00" marks showing where each person's name
   * and number will print. Drawn from the roster decoration settings so
   * changing the height, colour or location is visible on the garment
   * immediately, instead of only being described in a side panel.
   *
   * Draggable and resizable exactly like a real artwork layer once selected
   * — excluded from the ordinary layer stack only because it is not one:
   * this is a preview of per-garment personalisation (every shirt in the
   * order gets a different name here), not artwork the customer owns.
   */
  rosterPreview?: {
    target: "names" | "numbers";
    text: string;
    centerX: number;
    centerY: number;
    fontSize: number;
    color: string;
    halo: string;
    /**
     * A purely visual nudge (used when Names and Numbers share one location,
     * so the two marks do not fully overlap) — never part of the saved
     * position. Added on render and subtracted back out on drag/resize end,
     * so acting on a stacked mark reports where it would have started with
     * no stacking, not where the nudge happened to place it. Omitting this
     * would silently bake the stacking nudge into the saved state the first
     * time someone touched either mark.
     */
    renderOffsetY?: number;
  }[];
  /** Which roster mark, if any, is selected — drives whether it shows resize
   *  handles, matching `selectedId` for real artwork/text layers. Kept as
   *  its own prop rather than folded into `selectedId` because a roster
   *  mark is not a layer in `artworksBySide`/`textsBySide` and has no id to
   *  put there. */
  selectedRosterTarget?: "names" | "numbers" | null;
  onSelectRosterMark?: (target: "names" | "numbers" | null) => void;
  /**
   * Fires when the customer drops a dragged mark, with the position it
   * landed on in the same canvas-pixel space `rosterPreview` centers are
   * given in. This component stays presentation-only — it reports where the
   * mark landed and leaves converting that into a saved offset (and
   * clamping it to the garment) to the caller, the same division of
   * responsibility `onChangeArtwork` already has for real artwork layers.
   */
  onRosterPreviewDragEnd?: (
    target: "names" | "numbers",
    droppedX: number,
    droppedY: number,
  ) => void;
  /**
   * Fires when a resize handle is released. Reports the rendered result in
   * raw pixels/canvas-space — the same "stay presentation-only" split as
   * drag: converting pixels to inches, clamping to the schema's bounds, and
   * saving is the caller's job.
   */
  onRosterPreviewResizeEnd?: (
    target: "names" | "numbers",
    renderedHeightPx: number,
    centerX: number,
    centerY: number,
  ) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState(canvasSize);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () =>
      setDisplaySize(Math.max(280, Math.round(container.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [canvasSize]);

  const displayScale = (displaySize / canvasSize) * zoom;
  const offset = zoom < 1 ? (displaySize - displaySize * zoom) / 2 : 0;

  const stacked = [
    ...artworks.map((layer) => ({
      kind: "artwork" as const,
      z: layer.zIndex ?? 0,
      id: layer.id,
      layer,
    })),
    ...texts.map((layer) => ({
      kind: "text" as const,
      z: layer.zIndex ?? 0,
      id: layer.id,
      layer,
    })),
  ].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));

  return (
    <div ref={containerRef} className="absolute inset-0 max-w-full overflow-hidden">
      <Stage
        key={activeSide}
        ref={stageRef}
        width={displaySize}
        height={displaySize}
        className="absolute inset-0"
        onMouseDown={(event) => {
          const name = event.target.name();
          if (event.target === event.target.getStage() || name === "garment") {
            onSelect(null);
            onSelectRosterMark?.(null);
          }
        }}
      >
        <Layer>
          <Group x={offset} y={offset} scaleX={displayScale} scaleY={displayScale}>
            {garmentImageUrl ? (
              <GarmentLayer
                src={garmentImageUrl}
                canvasSize={canvasSize}
                mirrored={mirrorGarment}
                crop={garmentCrop}
                plate={garmentPlate}
                tintHex={garmentTintHex}
              />
            ) : null}
            {stacked.map((item) =>
              item.kind === "artwork" ? (
                <ArtworkLayer
                  key={item.id}
                  artwork={item.layer}
                  isSelected={selectedId === item.id}
                  onSelect={() => onSelect(item.id)}
                  onChange={onChangeArtwork}
                  onDragMove={onDragMove}
                  maxSize={maxArtworkDisplaySize(activeSide, displaySize)}
                />
              ) : (
                <TextLayer
                  key={item.id}
                  layer={item.layer}
                  isSelected={selectedId === item.id}
                  onSelect={() => onSelect(item.id)}
                  onChange={onChangeText}
                  onDragMove={onDragMove}
                />
              ),
            )}
            {(rosterPreview ?? []).map((mark) => (
              <RosterMarkNode
                key={`roster-preview-${mark.target}`}
                mark={mark}
                canvasSize={canvasSize}
                isSelected={selectedRosterTarget === mark.target}
                draggable={Boolean(onRosterPreviewDragEnd)}
                resizable={Boolean(onRosterPreviewResizeEnd)}
                onSelect={() => {
                  // A design tool shows one thing selected at a time — pick
                  // a roster mark and any selected artwork/text loses its
                  // own handles, matching the reverse (selecting artwork
                  // clears roster selection via the stage-level deselect).
                  onSelect(null);
                  onSelectRosterMark?.(mark.target);
                }}
                onDragEnd={(droppedX, droppedY) =>
                  onRosterPreviewDragEnd?.(mark.target, droppedX, droppedY)
                }
                onResizeEnd={(renderedHeightPx, centerX, centerY) =>
                  onRosterPreviewResizeEnd?.(
                    mark.target,
                    renderedHeightPx,
                    centerX,
                    centerY,
                  )
                }
              />
            ))}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
