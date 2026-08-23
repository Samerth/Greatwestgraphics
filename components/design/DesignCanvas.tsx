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
import { Group, Image as KonvaImage, Stage, Layer } from "react-konva";
import useImage from "use-image";
import { ArtworkLayer, type PlacedArtwork } from "@/components/design/ArtworkLayer";
import {
  SLEEVE_PLATE_INSET,
  cropPixels,
  plateContainRect,
  type PhotoCrop,
} from "@/lib/commerce/garment-backdrop";

function GarmentLayer({
  src,
  canvasSize,
  mirrored,
  crop,
  plate,
}: {
  src: string;
  canvasSize: number;
  mirrored: boolean;
  crop?: PhotoCrop;
  plate?: boolean;
}) {
  // Same-origin URLs (/_next/image, /api/uploads) must not request CORS.
  // Next's optimizer does not send Access-Control-Allow-Origin, so
  // crossOrigin=anonymous makes the garment fail to paint and the canvas
  // reads as a black box. Same-origin pixels are already readable for proofs.
  const sameOrigin = src.startsWith("/") && !src.startsWith("//");
  const [image] = useImage(src, sameOrigin ? undefined : "anonymous");
  if (!image) return null;

  const source = crop
    ? cropPixels(crop, image.naturalWidth, image.naturalHeight)
    : {
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
  const sourceAspect = image.naturalWidth / image.naturalHeight;
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
      image={image}
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

export default function DesignCanvas({
  activeSide,
  artworks,
  selectedId,
  canvasSize,
  garmentImageUrl,
  mirrorGarment,
  garmentCrop,
  garmentPlate,
  stageRef,
  onSelect,
  onChange,
}: {
  activeSide: string;
  artworks: PlacedArtwork[];
  selectedId: string | null;
  canvasSize: number;
  garmentImageUrl: string;
  mirrorGarment: boolean;
  garmentCrop?: PhotoCrop;
  garmentPlate?: boolean;
  stageRef: React.RefObject<any>;
  onSelect: (id: string) => void;
  onChange: (next: PlacedArtwork) => void;
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
    // ResizeObserver covers normal layout changes; the window event also
    // covers mobile viewport/orientation changes in browsers that do not
    // notify an absolutely positioned child promptly.
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [canvasSize]);

  const displayScale = displaySize / canvasSize;

  return (
    <div ref={containerRef} className="absolute inset-0 max-w-full overflow-hidden">
      <Stage
        key={activeSide}
        ref={stageRef}
        width={displaySize}
        height={displaySize}
        className="absolute inset-0"
      >
        <Layer>
          <Group scaleX={displayScale} scaleY={displayScale}>
            {garmentImageUrl ? (
              <GarmentLayer
                src={garmentImageUrl}
                canvasSize={canvasSize}
                mirrored={mirrorGarment}
                crop={garmentCrop}
                plate={garmentPlate}
              />
            ) : null}
            {artworks.map((a) => (
              <ArtworkLayer
                key={a.id}
                artwork={a}
                isSelected={selectedId === a.id}
                onSelect={() => onSelect(a.id)}
                onChange={onChange}
              />
            ))}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
