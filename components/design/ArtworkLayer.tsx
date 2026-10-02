"use client";

import { useRef, useEffect } from "react";
import { Group, Image as KonvaImage, Rect, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import type { PlacedArtwork } from "@gwg/contracts";
import {
  keepDraggedNodeOnCanvas,
  resizeWouldPushOffCanvas,
  type CanvasBounds,
} from "@/lib/commerce/studio-canvas-bounds";

export type { PlacedArtwork };

export function ArtworkLayer({
  artwork,
  isSelected,
  onSelect,
  onChange,
  onDragMove,
  maxSize = Infinity,
  canvasBounds,
}: {
  artwork: PlacedArtwork;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (next: PlacedArtwork) => void;
  onDragMove?: (next: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  /** Upper bound (display pixels) a resize handle can grow the artwork to —
   * keeps it from being dragged past the visible canvas. */
  maxSize?: number;
  /** Where the canvas spans in the stage's pixels (it moves with zoom).
   * Artwork is kept wholly inside it while dragging and resizing. */
  canvasBounds?: CanvasBounds;
}) {
  const [img] = useImage(artwork.src, "anonymous");
  const shapeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && img && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, img]);

  const naturalW = img?.width ?? 80;
  const naturalH = img?.height ?? 80;

  return (
    <>
      <Group
        ref={shapeRef}
        x={artwork.x}
        y={artwork.y}
        scaleX={artwork.scaleX}
        scaleY={artwork.scaleY}
        rotation={artwork.rotation}
        draggable
        /* Keeps the whole artwork on the canvas. Anything past the edge is
           cut from the proof image but still goes into the order, so a logo
           dragged half off the shirt looked fine on screen and arrived at the
           print shop cropped. Before this, only 24 px had to stay on, and the
           check ignored the artwork's size, so a small logo could still be
           dropped completely off the left or top edge (Pavin, 10 Sep, and the
           print-area notes after the client meeting). */
        dragBoundFunc={(pos) => {
          const node = shapeRef.current;
          if (!canvasBounds || !node) return pos;
          return keepDraggedNodeOnCanvas(node, pos, canvasBounds);
        }}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(event) =>
          onDragMove?.({
            id: artwork.id,
            x: event.target.x(),
            y: event.target.y(),
            width: naturalW * Math.abs(event.target.scaleX()),
            height: naturalH * Math.abs(event.target.scaleY()),
          })
        }
        onDragEnd={(e) =>
          onChange({ ...artwork, x: e.target.x(), y: e.target.y() })
        }
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          const next = {
            x: node.x(),
            y: node.y(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          };
          // Belt and suspenders on top of gating the Transformer on `img`
          // above: refuse to ever commit a non-finite transform, so one
          // more path into this bug (now or in a future change) can't
          // permanently corrupt the design the way it used to — the
          // customer keeps whatever was last valid instead of a shirt-
          // sized logo with no way back but delete-and-redo.
          if (!Object.values(next).every(Number.isFinite)) {
            console.error("[design-studio] ignored a non-finite transform", { artwork, next });
            return;
          }
          onChange({ ...artwork, ...next });
        }}
      >
        <KonvaImage image={img} />
        {artwork.outline && img ? (
          <Rect
            width={img.width}
            height={img.height}
            stroke={artwork.outlineColor ?? "#111111"}
            strokeWidth={2 / Math.max(0.02, Math.abs(artwork.scaleX))}
            listening={false}
          />
        ) : null}
      </Group>
      {/* Gated on `img`, not just `isSelected`: a freshly-uploaded artwork
          is selected immediately, before its image (loaded async via
          useImage) has arrived. Attaching the Transformer to a Group whose
          only child is an <Image> with no source yet gives Konva a
          zero-width/zero-height node to measure — dragging a resize handle
          against that computes a scale as new-size ÷ 0, i.e. NaN/Infinity,
          which then gets written into the design permanently via
          onTransformEnd (no amount of clamping in boundBoxFunc below saves
          this: every comparison against a NaN is false, so the guard rails
          silently do nothing once the corruption has already happened).
          The fix is to simply not offer resize handles on a shape that
          isn't really there yet. */}
      {isSelected && img && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          /* Size was already capped here; position was not, so a corner
             drag could grow a logo straight off the canvas even though its
             dimensions were legal (Pavin, 10 Sep: "increasing the size of the
             image gets it out of bound from the canvas"). A resize is refused
             when it would push the artwork further past the edge than it
             already was, so artwork that overhangs can still be shrunk back
             in. A rejected box returns the previous one so the shape stops
             at the edge rather than snapping back. */
          boundBoxFunc={(oldBox, newBox) => {
            if (
              newBox.width < 20 ||
              newBox.height < 20 ||
              newBox.width > maxSize ||
              newBox.height > maxSize
            ) {
              return oldBox;
            }
            // Unrotated boxes only: for a rotated one x/y/width/height are not
            // the visible extent, and the drag guard still applies afterwards.
            if (
              canvasBounds &&
              Math.abs(newBox.rotation) < 0.001 &&
              resizeWouldPushOffCanvas(oldBox, newBox, canvasBounds)
            ) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}
