import {
  DESIGN_CANVAS_SIZE,
  DesignSides,
  type DesignDocument,
  type DesignSide,
  type PlacedArtwork,
  type PlacedText,
  type TextAlign,
  type TextPrintMethod,
} from "@gwg/contracts";
import { STUDIO_DEFAULT_FONT_ID } from "./studio-fonts";
import {
  STUDIO_PRINT_AREAS,
  artworkOriginInPrintArea,
  frontChestZoneForAlign,
  isFrontChestZone,
  placementAreaPixels,
  placementIntent,
  printAreaPixels,
  type PlacementAlignX,
} from "./studio-placement";
import { detectPlacementZone } from "./studio-zones";

export const STUDIO_DEFAULT_TEXT = "Your text";
export const STUDIO_DEFAULT_FONT_SIZE = 28;
export const STUDIO_DEFAULT_TEXT_FILL = "#111111";

export function estimateTextDisplaySize(
  text: string,
  fontSize: number,
  letterSpacing = 0,
): { width: number; height: number } {
  const chars = Math.max(1, text.length);
  return {
    width: Math.max(24, chars * fontSize * 0.55 + letterSpacing * (chars - 1)),
    height: fontSize * 1.25,
  };
}

export function createStudioTextLayer(input: {
  side: DesignSide;
  text?: string;
  canvasSize?: number;
  zone?: string;
  id?: string;
  fontFamily?: string;
  fontSize?: number;
  fill?: string;
  align?: TextAlign;
  printMethod?: TextPrintMethod;
}): PlacedText {
  const canvasSize = input.canvasSize ?? DESIGN_CANVAS_SIZE;
  const zone = input.zone ?? "Center Chest";
  const fontSize = input.fontSize ?? STUDIO_DEFAULT_FONT_SIZE;
  const text = input.text?.trim() ? input.text : STUDIO_DEFAULT_TEXT;
  const display = estimateTextDisplaySize(text, fontSize);
  const area = placementAreaPixels(input.side, zone, canvasSize);
  const intent = placementIntent(input.side, zone);
  const inChestBox = input.side === "front" && isFrontChestZone(zone);
  const origin = artworkOriginInPrintArea({
    area,
    displayWidth: display.width,
    displayHeight: display.height,
    alignX: inChestBox ? "center" : intent.alignX,
    alignY: inChestBox ? "center" : intent.alignY,
  });
  return {
    id: input.id ?? `text-${cryptoRandomId()}`,
    text,
    x: origin.x,
    y: origin.y,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    fontFamily: input.fontFamily ?? STUDIO_DEFAULT_FONT_ID,
    fontSize,
    fill: input.fill ?? STUDIO_DEFAULT_TEXT_FILL,
    align: input.align ?? "center",
    printMethod: input.printMethod ?? "print",
    letterSpacing: 0,
    arc: 0,
    outline: false,
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `text-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * SVG path for Konva `TextPath`. `arc` is degrees of curvature: 0 is a
 * straight baseline; positive bulges up (canvas Y-down, so control Y is
 * negative); negative bulges down.
 */
export function studioTextArcSvgPath(width: number, arc: number): string {
  const w = Math.max(20, width);
  if (!Number.isFinite(arc) || Math.abs(arc) < 1) {
    return `M 0 0 L ${w} 0`;
  }
  const clamped = Math.min(160, Math.abs(arc));
  const theta = (clamped * Math.PI) / 180;
  const radius = w / (2 * Math.sin(theta / 2));
  const sagitta = radius - radius * Math.cos(theta / 2);
  const bulge = arc > 0 ? -sagitta : sagitta;
  return `M 0 0 Q ${w / 2} ${bulge} ${w} 0`;
}

function relocateLayerOnSide<T extends { x: number; y: number }>(
  layer: T,
  fromSide: DesignSide,
  toSide: DesignSide,
  canvasSize: number,
): T {
  if (fromSide === toSide) return layer;
  const from = STUDIO_PRINT_AREAS[fromSide];
  const to = STUDIO_PRINT_AREAS[toSide];
  const relX = from.width <= 0 ? 0.5 : (layer.x / canvasSize - from.x) / from.width;
  const relY =
    from.height <= 0 ? 0.5 : (layer.y / canvasSize - from.y) / from.height;
  return {
    ...layer,
    x: (to.x + relX * to.width) * canvasSize,
    y: (to.y + relY * to.height) * canvasSize,
  };
}

export function findStudioLayerSide(
  document: DesignDocument,
  layerId: string,
): { side: DesignSide; kind: "artwork" | "text" } | null {
  for (const side of DesignSides) {
    if (document.artworksBySide[side].some((layer) => layer.id === layerId)) {
      return { side, kind: "artwork" };
    }
    if (document.textsBySide?.[side]?.some((layer) => layer.id === layerId)) {
      return { side, kind: "text" };
    }
  }
  return null;
}

/**
 * Jumps artwork or text onto another garment view, keeping its position
 * relative to that view's print area, and updates `placementBySide` from
 * the landing spot.
 */
export function moveStudioLayerToSide(
  document: DesignDocument,
  layerId: string,
  toSide: DesignSide,
  canvasSize = DESIGN_CANVAS_SIZE,
): {
  document: DesignDocument;
  fromSide: DesignSide | null;
  kind: "artwork" | "text" | null;
} {
  const found = findStudioLayerSide(document, layerId);
  if (!found) {
    return { document, fromSide: null, kind: null };
  }
  if (found.side === toSide) {
    return { document, fromSide: found.side, kind: found.kind };
  }

  if (found.kind === "artwork") {
    const layer = document.artworksBySide[found.side].find(
      (item) => item.id === layerId,
    )!;
    const moved = relocateLayerOnSide(layer, found.side, toSide, canvasSize);
    const nextArtworks = {
      ...document.artworksBySide,
      [found.side]: document.artworksBySide[found.side].filter(
        (item) => item.id !== layerId,
      ),
      [toSide]: [...document.artworksBySide[toSide], moved],
    };
    return {
      document: withDetectedZone(
        { ...document, artworksBySide: nextArtworks },
        toSide,
        moved,
        80,
        80,
        canvasSize,
      ),
      fromSide: found.side,
      kind: "artwork",
    };
  }

  const layer = document.textsBySide[found.side].find(
    (item) => item.id === layerId,
  )!;
  const moved = relocateLayerOnSide(layer, found.side, toSide, canvasSize);
  const display = estimateTextDisplaySize(
    moved.text,
    moved.fontSize,
    moved.letterSpacing,
  );
  const nextTexts = {
    ...document.textsBySide,
    [found.side]: document.textsBySide[found.side].filter(
      (item) => item.id !== layerId,
    ),
    [toSide]: [...document.textsBySide[toSide], moved],
  };
  return {
    document: withDetectedZone(
      { ...document, textsBySide: nextTexts },
      toSide,
      moved,
      display.width * Math.abs(moved.scaleX),
      display.height * Math.abs(moved.scaleY),
      canvasSize,
    ),
    fromSide: found.side,
    kind: "text",
  };
}

export function withDetectedZone<
  T extends { x: number; y: number; scaleX?: number; scaleY?: number },
>(
  document: DesignDocument,
  side: DesignSide,
  layer: T,
  width: number,
  height: number,
  canvasSize = DESIGN_CANVAS_SIZE,
): DesignDocument {
  const zone = detectPlacementZone({
    side,
    x: layer.x,
    y: layer.y,
    width,
    height,
    canvasSize,
  });
  if (document.placementBySide[side] === zone) return document;
  return {
    ...document,
    placementBySide: { ...document.placementBySide, [side]: zone },
  };
}

function studioLayerZIndexes(document: DesignDocument, side: DesignSide): number[] {
  return [
    ...document.artworksBySide[side].map((item) => item.zIndex ?? 0),
    ...document.textsBySide[side].map((item) => item.zIndex ?? 0),
  ];
}

export function duplicateStudioLayer(
  document: DesignDocument,
  layerId: string,
  newId: string,
): { document: DesignDocument; duplicateId: string | null } {
  const found = findStudioLayerSide(document, layerId);
  if (!found) return { document, duplicateId: null };
  const offset = 14;
  const zs = studioLayerZIndexes(document, found.side);
  const zIndex = (zs.length ? Math.max(...zs) : 0) + 1;
  if (found.kind === "artwork") {
    const layer = document.artworksBySide[found.side].find(
      (item) => item.id === layerId,
    ) as PlacedArtwork;
    const copy: PlacedArtwork = {
      ...layer,
      id: newId,
      x: layer.x + offset,
      y: layer.y + offset,
      zIndex,
    };
    return {
      document: {
        ...document,
        artworksBySide: {
          ...document.artworksBySide,
          [found.side]: [...document.artworksBySide[found.side], copy],
        },
      },
      duplicateId: newId,
    };
  }
  const layer = document.textsBySide[found.side].find(
    (item) => item.id === layerId,
  ) as PlacedText;
  const copy: PlacedText = {
    ...layer,
    id: newId,
    x: layer.x + offset,
    y: layer.y + offset,
    zIndex,
  };
  return {
    document: {
      ...document,
      textsBySide: {
        ...document.textsBySide,
        [found.side]: [...document.textsBySide[found.side], copy],
      },
    },
    duplicateId: newId,
  };
}

export function deleteStudioLayer(
  document: DesignDocument,
  layerId: string,
): DesignDocument {
  const found = findStudioLayerSide(document, layerId);
  if (!found) return document;
  if (found.kind === "artwork") {
    return {
      ...document,
      artworksBySide: {
        ...document.artworksBySide,
        [found.side]: document.artworksBySide[found.side].filter(
          (item) => item.id !== layerId,
        ),
      },
    };
  }
  return {
    ...document,
    textsBySide: {
      ...document.textsBySide,
      [found.side]: document.textsBySide[found.side].filter(
        (item) => item.id !== layerId,
      ),
    },
  };
}

export function alignStudioLayer(
  document: DesignDocument,
  layerId: string,
  alignX: PlacementAlignX,
  canvasSize = DESIGN_CANVAS_SIZE,
  displayWidth = 80,
  displayHeight = 40,
): DesignDocument {
  const found = findStudioLayerSide(document, layerId);
  if (!found) return document;
  const zone =
    found.side === "front"
      ? frontChestZoneForAlign(alignX)
      : document.placementBySide[found.side];
  const area =
    found.side === "front"
      ? placementAreaPixels(found.side, zone, canvasSize)
      : printAreaPixels(found.side, canvasSize);
  const origin = artworkOriginInPrintArea({
    area,
    displayWidth,
    displayHeight,
    alignX: found.side === "front" ? "center" : alignX,
    alignY: "center",
  });
  const nextPlacement =
    found.side === "front"
      ? { ...document.placementBySide, front: zone }
      : document.placementBySide;
  if (found.kind === "artwork") {
    return {
      ...document,
      placementBySide: nextPlacement,
      artworksBySide: {
        ...document.artworksBySide,
        [found.side]: document.artworksBySide[found.side].map((item) =>
          item.id === layerId
            ? { ...item, x: origin.x, y: origin.y }
            : item,
        ),
      },
    };
  }
  return {
    ...document,
    placementBySide: nextPlacement,
    textsBySide: {
      ...document.textsBySide,
      [found.side]: document.textsBySide[found.side].map((item) =>
        item.id === layerId ? { ...item, x: origin.x, y: origin.y } : item,
      ),
    },
  };
}

export function centerStudioLayer(
  document: DesignDocument,
  layerId: string,
  canvasSize = DESIGN_CANVAS_SIZE,
  displayWidth = 80,
  displayHeight = 40,
): DesignDocument {
  return alignStudioLayer(
    document,
    layerId,
    "center",
    canvasSize,
    displayWidth,
    displayHeight,
  );
}

export function nudgeStudioLayerOrder(
  document: DesignDocument,
  layerId: string,
  direction: "forward" | "back",
): DesignDocument {
  const found = findStudioLayerSide(document, layerId);
  if (!found) return document;
  const zs = studioLayerZIndexes(document, found.side);
  const nextZ =
    direction === "forward"
      ? (zs.length ? Math.max(...zs) : 0) + 1
      : (zs.length ? Math.min(...zs) : 0) - 1;
  if (found.kind === "artwork") {
    return {
      ...document,
      artworksBySide: {
        ...document.artworksBySide,
        [found.side]: document.artworksBySide[found.side].map((item) =>
          item.id === layerId ? { ...item, zIndex: nextZ } : item,
        ),
      },
    };
  }
  return {
    ...document,
    textsBySide: {
      ...document.textsBySide,
      [found.side]: document.textsBySide[found.side].map((item) =>
        item.id === layerId ? { ...item, zIndex: nextZ } : item,
      ),
    },
  };
}

export function patchStudioText(
  document: DesignDocument,
  layerId: string,
  patch: Partial<PlacedText>,
): DesignDocument {
  const found = findStudioLayerSide(document, layerId);
  if (!found || found.kind !== "text") return document;
  return {
    ...document,
    textsBySide: {
      ...document.textsBySide,
      [found.side]: document.textsBySide[found.side].map((item) =>
        item.id === layerId ? { ...item, ...patch, id: item.id } : item,
      ),
    },
  };
}

export function patchStudioArtwork(
  document: DesignDocument,
  layerId: string,
  patch: Partial<PlacedArtwork>,
): DesignDocument {
  const found = findStudioLayerSide(document, layerId);
  if (!found || found.kind !== "artwork") return document;
  return {
    ...document,
    artworksBySide: {
      ...document.artworksBySide,
      [found.side]: document.artworksBySide[found.side].map((item) =>
        item.id === layerId ? { ...item, ...patch, id: item.id } : item,
      ),
    },
  };
}
