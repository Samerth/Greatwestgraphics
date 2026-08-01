function parseHex(hex: string): [number, number, number] | null {
  const cleaned = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return [
    Number.parseInt(cleaned.slice(0, 2), 16),
    Number.parseInt(cleaned.slice(2, 4), 16),
    Number.parseInt(cleaned.slice(4, 6), 16),
  ];
}

export function hexToRgba(hex: string, alpha: number): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function darken(hex: string, amount: number): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const factor = 1 - amount;
  const [r, g, b] = rgb.map((c) => Math.max(0, Math.round(c * factor)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** CSS custom-property overrides for a store's brand colour, or null if unset/invalid. */
export function brandColorVars(accentColor: string | null): Record<string, string> | null {
  if (!accentColor) return null;
  const hover = darken(accentColor, 0.18);
  const tint = hexToRgba(accentColor, 0.1);
  const tintStrong = hexToRgba(accentColor, 0.18);
  if (!hover || !tint || !tintStrong) return null;
  return {
    "--color-accent": accentColor,
    "--color-accent-hover": hover,
    "--color-accent-tint": tint,
    "--color-accent-tint-strong": tintStrong,
  };
}
