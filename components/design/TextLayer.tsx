"use client";

import { useEffect, useMemo, useRef } from "react";
import { Text, TextPath, Transformer } from "react-konva";
import type Konva from "konva";
import type { PlacedText } from "@gwg/contracts";
import { konvaFontFamily } from "@/lib/commerce/studio-fonts";
import {
  estimateTextDisplaySize,
  studioTextArcSvgPath,
} from "@/lib/commerce/studio-text";

export function TextLayer({
  layer,
  isSelected,
  onSelect,
  onChange,
  onDragMove,
}: {
  layer: PlacedText;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (next: PlacedText) => void;
  onDragMove?: (next: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}) {
  const shapeRef = useRef<Konva.Text | Konva.TextPath>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const family = konvaFontFamily(layer.fontFamily);
  const display = estimateTextDisplaySize(
    layer.text,
    layer.fontSize,
    layer.letterSpacing,
  );
  const arc = layer.arc ?? 0;
  const curved = Math.abs(arc) >= 1;
  const path = useMemo(
    () => studioTextArcSvgPath(display.width, arc),
    [display.width, arc],
  );

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, curved, layer.text, layer.fontFamily, layer.fontSize]);

  const shared = {
    x: layer.x,
    y: layer.y,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    rotation: layer.rotation,
    fill: layer.fill,
    fontFamily: family,
    fontSize: layer.fontSize,
    letterSpacing: layer.letterSpacing ?? 0,
    stroke: layer.outline ? (layer.outlineColor ?? "#111111") : undefined,
    strokeWidth: layer.outline ? (layer.outlineWidth ?? 1.5) : 0,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
      onDragMove?.({
        id: layer.id,
        x: event.target.x(),
        y: event.target.y(),
        width: display.width * Math.abs(event.target.scaleX()),
        height: display.height * Math.abs(event.target.scaleY()),
      });
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) =>
      onChange({ ...layer, x: event.target.x(), y: event.target.y() }),
    onTransformEnd: () => {
      const node = shapeRef.current;
      if (!node) return;
      onChange({
        ...layer,
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      });
    },
  };

  return (
    <>
      {curved ? (
        <TextPath
          ref={shapeRef as React.RefObject<Konva.TextPath>}
          {...shared}
          text={layer.text}
          data={path}
        />
      ) : (
        <Text
          ref={shapeRef as React.RefObject<Konva.Text>}
          {...shared}
          text={layer.text}
          align={layer.align}
        />
      )}
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
            newBox.width < 16 || newBox.height < 12 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}
