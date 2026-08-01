"use client";

// This file must only ever be loaded client-side via next/dynamic(..., { ssr:
// false }) in DesignStudio.tsx, and Stage/Layer must be plain (non-lazy)
// imports here. react-konva's custom reconciler calls flushSync internally
// on stage updates; if Stage/Layer are themselves React.lazy-wrapped (e.g.
// via next/dynamic), that synchronous flush can fire before the lazy import
// resolves, outside any Suspense boundary, throwing "Element type is
// invalid... Lazy element type must resolve to a class or function." Lazy-
// loading the whole canvas as one unit (this file) avoids that entirely.
import { Stage, Layer } from "react-konva";
import { ArtworkLayer, type PlacedArtwork } from "@/components/design/ArtworkLayer";

export default function DesignCanvas({
  activeSide,
  artworks,
  selectedId,
  canvasSize,
  stageRef,
  onSelect,
  onChange,
}: {
  activeSide: string;
  artworks: PlacedArtwork[];
  selectedId: string | null;
  canvasSize: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stageRef: React.RefObject<any>;
  onSelect: (id: string) => void;
  onChange: (next: PlacedArtwork) => void;
}) {
  return (
    <Stage
      key={activeSide}
      ref={stageRef}
      width={canvasSize}
      height={canvasSize}
      className="absolute inset-0"
    >
      <Layer>
        {artworks.map((a) => (
          <ArtworkLayer
            key={a.id}
            artwork={a}
            isSelected={selectedId === a.id}
            onSelect={() => onSelect(a.id)}
            onChange={onChange}
          />
        ))}
      </Layer>
    </Stage>
  );
}
