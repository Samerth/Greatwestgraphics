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
}) {
  const [img] = useImage(artwork.src, "anonymous");
  const shapeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

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
          onChange({
            ...artwork,
            x: node.x(),
            y: node.y(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          });
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
      {isSelected && (
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
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}
