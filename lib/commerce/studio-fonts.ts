/**
 * Fonts the Design Studio may put on a garment.
 *
 * System stacks are web-safe and need no download. Local families are the
 * site fonts already self-hosted in `app/layout.tsx` (Space Grotesk, IBM Plex
 * Sans). Web fonts are SIL-OFL Google Fonts loaded at runtime from the studio
 * client — never via `next/font/google`, which fetches at docker build time
 * and has already failed CI when fonts.gstatic.com was unreachable.
 */

export type StudioFontKind = "system" | "local" | "webfont";

export type StudioFont = {
  id: string;
  label: string;
  /** CSS `font-family` for picker previews. */
  family: string;
  kind: StudioFontKind;
  /** Google Fonts family when `kind === "webfont"`. */
  googleFamily?: string;
  /** CSS variable on `<html>` for local next/font files. */
  cssVariable?: string;
};

export const STUDIO_FONTS: readonly StudioFont[] = [
  {
    id: "arial",
    label: "Arial",
    family: "Arial, Helvetica, sans-serif",
    kind: "system",
  },
  {
    id: "verdana",
    label: "Verdana",
    family: "Verdana, Geneva, sans-serif",
    kind: "system",
  },
  {
    id: "tahoma",
    label: "Tahoma",
    family: "Tahoma, sans-serif",
    kind: "system",
  },
  {
    id: "trebuchet",
    label: "Trebuchet MS",
    family: '"Trebuchet MS", sans-serif',
    kind: "system",
  },
  {
    id: "georgia",
    label: "Georgia",
    family: "Georgia, serif",
    kind: "system",
  },
  {
    id: "times",
    label: "Times New Roman",
    family: '"Times New Roman", Times, serif',
    kind: "system",
  },
  {
    id: "palatino",
    label: "Palatino",
    family: '"Palatino Linotype", Palatino, serif',
    kind: "system",
  },
  {
    id: "courier",
    label: "Courier New",
    family: '"Courier New", Courier, monospace',
    kind: "system",
  },
  {
    id: "impact",
    label: "Impact",
    family: "Impact, Haettenschweiler, sans-serif",
    kind: "system",
  },
  {
    id: "comic",
    label: "Comic Sans MS",
    family: '"Comic Sans MS", "Comic Sans", cursive',
    kind: "system",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    family: "var(--font-display), sans-serif",
    kind: "local",
    cssVariable: "--font-display",
  },
  {
    id: "ibm-plex",
    label: "IBM Plex Sans",
    family: "var(--font-body), sans-serif",
    kind: "local",
    cssVariable: "--font-body",
  },
  {
    id: "oswald",
    label: "Oswald",
    family: '"Oswald", sans-serif',
    kind: "webfont",
    googleFamily: "Oswald",
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    family: '"Bebas Neue", sans-serif',
    kind: "webfont",
    googleFamily: "Bebas Neue",
  },
  {
    id: "pacifico",
    label: "Pacifico",
    family: '"Pacifico", cursive',
    kind: "webfont",
    googleFamily: "Pacifico",
  },
  {
    id: "permanent-marker",
    label: "Permanent Marker",
    family: '"Permanent Marker", cursive',
    kind: "webfont",
    googleFamily: "Permanent Marker",
  },
];

export const STUDIO_DEFAULT_FONT_ID = "arial";

export const STUDIO_TEXT_SWATCHES = [
  "#111111",
  "#ffffff",
  "#1b2a4a",
  "#c41e3a",
  "#1e4bd1",
  "#1f4d2e",
  "#d4a017",
  "#6e1a2b",
  "#e07a1f",
  "#e89bb0",
] as const;

export function studioFontById(id: string): StudioFont {
  return STUDIO_FONTS.find((font) => font.id === id) ?? STUDIO_FONTS[0]!;
}

export function studioGoogleFontsHref(): string | null {
  const families = STUDIO_FONTS.filter(
    (font): font is StudioFont & { googleFamily: string } =>
      font.kind === "webfont" && Boolean(font.googleFamily),
  ).map((font) => {
    const family = font.googleFamily.replace(/ /g, "+");
    return `family=${family}:wght@400;600`;
  });
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/** Family name Konva / canvas can resolve after fonts have loaded. */
export function konvaFontFamily(fontId: string): string {
  const font = studioFontById(fontId);
  if (typeof document !== "undefined" && font.cssVariable) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(font.cssVariable)
      .trim();
    if (value) return value.replace(/^["']|["']$/g, "");
  }
  if (font.googleFamily) return font.googleFamily;
  return font.family.split(",")[0]!.replace(/["']/g, "").trim();
}

export async function ensureStudioFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await document.fonts.ready;
  await Promise.all(
    STUDIO_FONTS.map((font) =>
      document.fonts.load(`24px "${konvaFontFamily(font.id)}"`).catch(() => {
        // A missing system face still falls back; do not reject the studio.
      }),
    ),
  );
}
