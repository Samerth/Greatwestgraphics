"use client";

import { useRef, useEffect } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";

export interface PlacedArtwork {
  id: string;
  src: string; // object URL for now — swap to a real hosted URL once storage is picked
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export function ArtworkLayer({
  artwork,
  isSelected,
  onSelect,
  onChange,
}: {
  artwork: PlacedArtwork;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (next: PlacedArtwork) => void;
}) {
  const [img] = useImage(artwork.src, "anonymous");
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={img}
        x={artwork.x}
        y={artwork.y}
        scaleX={artwork.scaleX}
        scaleY={artwork.scaleY}
        rotation={artwork.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
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
      />
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