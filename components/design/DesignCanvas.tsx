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
import type { PlacedArtwork, PlacedText } from "@gwg/contracts";
import { ArtworkLayer } from "@/components/design/ArtworkLayer";
import { TextLayer } from "@/components/design/TextLayer";
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
                  maxSize={displaySize}
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
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
