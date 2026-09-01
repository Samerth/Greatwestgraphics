"use client";

import { useRef, useEffect } from "react";
import { Group, Image as KonvaImage, Rect, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import type { PlacedArtwork } from "@gwg/contracts";

export type { PlacedArtwork };

export function ArtworkLayer({
  artwork,
  isSelected,
  onSelect,
  onChange,
  onDragMove,
  maxSize = Infinity,
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
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 ||
            newBox.height < 20 ||
            newBox.width > maxSize ||
            newBox.height > maxSize
              ? oldBox
              : newBox
          }
        />
      )}
    </>
  );
}
