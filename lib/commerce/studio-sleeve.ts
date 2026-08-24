import type { DesignSide } from "@gwg/contracts";
import {
  hexForColorName,
  normalizeStudioHex,
  type StudioColorwayOption,
} from "@/lib/commerce/studio-garments";

export const STUDIO_SLEEVE_SIDES = ["left", "right"] as const;
export type StudioSleeveSide = (typeof STUDIO_SLEEVE_SIDES)[number];

/** Compact labels for the designer’s side thumbnails. */
export const DESIGN_SIDE_THUMB_LABELS: Record<DesignSide, string> = {
  front: "Front",
  back: "Back",
  left: "L.Sleeve",
  right: "R.Sleeve",
};

export const DEFAULT_SLEEVE_FILL_HEX = "#d8d4cc";
export const SLEEVE_VIEWBOX = { width: 200, height: 240 } as const;

export function isStudioSleeveSide(side: DesignSide): side is StudioSleeveSide {
  return side === "left" || side === "right";
}

/** Vendor hex when present; otherwise the named-colour map; otherwise a warm grey. */
export function studioSleeveFillHex(input: {
  hex?: string | null;
  colorName?: string | null;
}): string {
  return (
    normalizeStudioHex(input.hex) ??
    hexForColorName(input.colorName ?? "") ??
    DEFAULT_SLEEVE_FILL_HEX
  );
}

export function studioSleeveFillFromColorway(
  colorway?: Pick<StudioColorwayOption, "hex" | "colorName"> | null,
  fallbackName?: string | null,
): string {
  return studioSleeveFillHex({
    hex: colorway?.hex ?? hexForColorName(colorway?.colorName ?? ""),
    colorName: colorway?.colorName ?? fallbackName,
  });
}

function parseRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeStudioHex(hex);
  if (!normalized) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

export function hexLuminance(hex: string): number {
  const rgb = parseRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function mixHex(hex: string, toward: string, amount: number): string {
  const from = parseRgb(hex);
  const to = parseRgb(toward);
  if (!from || !to) return normalizeStudioHex(hex) ?? DEFAULT_SLEEVE_FILL_HEX;
  const t = Math.min(1, Math.max(0, amount));
  const channel = (index: 0 | 1 | 2) =>
    Math.round(from[index] + (to[index] - from[index]) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** Dark shirts need a light outline; light shirts need ink. */
export function sleeveOutlineHex(fillHex: string): string {
  return hexLuminance(fillHex) < 0.42 ? "#f3f1ec" : "#1c1c1c";
}

export type SleeveIllustrationModel = {
  side: StudioSleeveSide;
  fillHex: string;
  outlineHex: string;
  shadeHex: string;
  collarHex: string;
  garmentPath: string;
  collarPath: string;
  seamPath: string;
  cuffPath: string;
  hemPath: string;
  sheenPath: string;
  cuffNotchPath: string;
};

type PathCmd =
  | { t: "M"; x: number; y: number }
  | { t: "L"; x: number; y: number }
  | {
      t: "C";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x: number;
      y: number;
    }
  | { t: "Z" };

function flipX(value: number, side: StudioSleeveSide): number {
  return side === "right" ? SLEEVE_VIEWBOX.width - value : value;
}

function serializePath(commands: readonly PathCmd[], side: StudioSleeveSide): string {
  return commands
    .map((command) => {
      if (command.t === "Z") return "Z";
      if (command.t === "M") {
        return `M ${flipX(command.x, side)} ${command.y}`;
      }
      if (command.t === "L") {
        return `L ${flipX(command.x, side)} ${command.y}`;
      }
      return `C ${flipX(command.x1, side)} ${command.y1}, ${flipX(command.x2, side)} ${command.y2}, ${flipX(command.x, side)} ${command.y}`;
    })
    .join(" ");
}

/**
 * Original Great West 3/4 short-sleeve plate.
 * Left: body recedes to the left, printable sleeve face stays centered.
 * Right: the same construction mirrored — distinct path data, not a CSS flip.
 */
export function sleeveIllustrationModel(input: {
  side: StudioSleeveSide;
  fillHex: string;
}): SleeveIllustrationModel {
  const fillHex = studioSleeveFillHex({ hex: input.fillHex });
  const side = input.side;
  const outlineHex = sleeveOutlineHex(fillHex);
  const shadeHex = mixHex(fillHex, "#0d0d0d", 0.18);
  const collarHex = mixHex(fillHex, "#0d0d0d", 0.28);

  const garmentPath = serializePath(
    [
      { t: "M", x: 88, y: 36 },
      { t: "C", x1: 76, y1: 38, x2: 60, y2: 48, x: 54, y: 62 },
      { t: "C", x1: 48, y1: 74, x2: 58, y2: 86, x: 70, y: 92 },
      { t: "C", x1: 72, y1: 140, x2: 74, y2: 190, x: 78, y: 220 },
      { t: "C", x1: 80, y1: 228, x2: 90, y2: 232, x: 102, y: 232 },
      { t: "L", x: 122, y: 232 },
      { t: "C", x1: 134, y1: 232, x2: 138, y2: 226, x: 136, y: 218 },
      { t: "C", x1: 134, y1: 180, x2: 132, y2: 150, x: 130, y: 122 },
      { t: "C", x1: 152, y1: 130, x2: 172, y2: 136, x: 182, y: 126 },
      { t: "C", x1: 192, y1: 116, x2: 192, y2: 102, x: 182, y: 92 },
      { t: "C", x1: 168, y1: 78, x2: 150, y2: 66, x: 136, y: 56 },
      { t: "C", x1: 128, y1: 42, x2: 116, y2: 32, x: 102, y: 30 },
      { t: "C", x1: 96, y1: 30, x2: 92, y2: 32, x: 88, y: 36 },
      { t: "Z" },
    ],
    side,
  );

  const collarPath = serializePath(
    [
      { t: "M", x: 90, y: 40 },
      { t: "C", x1: 100, y1: 34, x2: 112, y2: 36, x: 118, y: 44 },
      { t: "C", x1: 112, y1: 56, x2: 100, y2: 60, x: 90, y: 52 },
      { t: "Z" },
    ],
    side,
  );

  const seamPath = serializePath(
    [
      { t: "M", x: 118, y: 56 },
      { t: "C", x1: 122, y1: 84, x2: 126, y2: 104, x: 128, y: 122 },
    ],
    side,
  );

  const cuffPath = serializePath(
    [
      { t: "M", x: 166, y: 96 },
      { t: "C", x1: 178, y1: 106, x2: 180, y2: 118, x: 174, y: 128 },
    ],
    side,
  );

  const hemPath = serializePath(
    [
      { t: "M", x: 82, y: 220 },
      { t: "C", x1: 102, y1: 226, x2: 118, y2: 226, x: 132, y: 220 },
    ],
    side,
  );

  const sheenPath = serializePath(
    [
      { t: "M", x: 98, y: 50 },
      { t: "C", x1: 128, y1: 66, x2: 150, y2: 96, x: 146, y: 132 },
      { t: "C", x1: 128, y1: 120, x2: 108, y2: 88, x: 98, y: 50 },
      { t: "Z" },
    ],
    side,
  );

  const cuffNotchPath = serializePath(
    [
      { t: "M", x: 174, y: 116 },
      { t: "L", x: 182, y: 120 },
      { t: "L", x: 176, y: 124 },
      { t: "Z" },
    ],
    side,
  );

  return {
    side,
    fillHex,
    outlineHex,
    shadeHex,
    collarHex,
    garmentPath,
    collarPath,
    seamPath,
    cuffPath,
    hemPath,
    sheenPath,
    cuffNotchPath,
  };
}

export function sleeveIllustrationSvg(input: {
  side: StudioSleeveSide;
  fillHex: string;
}): string {
  const model = sleeveIllustrationModel(input);
  const { width, height } = SLEEVE_VIEWBOX;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" data-sleeve-side="${model.side}" data-sleeve-fill="${model.fillHex}" fill="none">`,
    `<path data-sleeve-part="fill" d="${model.garmentPath}" fill="${model.fillHex}"/>`,
    `<path data-sleeve-part="shade" d="${model.garmentPath}" fill="${model.shadeHex}" opacity="0.22"/>`,
    `<path data-sleeve-part="sheen" d="${model.sheenPath}" fill="#ffffff" opacity="0.14"/>`,
    `<path data-sleeve-part="collar" d="${model.collarPath}" fill="${model.collarHex}" stroke="${model.outlineHex}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-sleeve-part="outline" d="${model.garmentPath}" stroke="${model.outlineHex}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<path data-sleeve-part="seam" d="${model.seamPath}" stroke="${model.outlineHex}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>`,
    `<path data-sleeve-part="cuff" d="${model.cuffPath}" stroke="${model.outlineHex}" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>`,
    `<path data-sleeve-part="hem" d="${model.hemPath}" stroke="${model.outlineHex}" stroke-width="1.3" stroke-linecap="round" opacity="0.75"/>`,
    `<path data-sleeve-part="notch" d="${model.cuffNotchPath}" fill="${model.outlineHex}" opacity="0.85"/>`,
    `</svg>`,
  ].join("");
}

export function sleeveIllustrationDataUrl(input: {
  side: StudioSleeveSide;
  fillHex: string;
}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    sleeveIllustrationSvg(input),
  )}`;
}
