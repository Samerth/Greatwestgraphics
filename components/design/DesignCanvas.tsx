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

function GarmentLayer({
  src,
  canvasSize,
  mirrored,
}: {
  src: string;
  canvasSize: number;
  mirrored: boolean;
}) {
  const [image] = useImage(src, "anonymous");
  if (!image) return null;

  const scale = Math.min(
    canvasSize / image.naturalWidth,
    canvasSize / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  return (
    <KonvaImage
      image={image}
      x={mirrored ? (canvasSize + width) / 2 : (canvasSize - width) / 2}
      y={(canvasSize - height) / 2}
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            <GarmentLayer
              src={garmentImageUrl}
              canvasSize={canvasSize}
              mirrored={mirrorGarment}
            />
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
