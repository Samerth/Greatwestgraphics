import { describe, expect, it } from "vitest";
import {
  STUDIO_FONTS,
  studioFontById,
  studioGoogleFontsHref,
} from "./studio-fonts";

describe("STUDIO_FONTS", () => {
  it("ships at least ten licensed or web-safe faces with unique ids", () => {
    expect(STUDIO_FONTS.length).toBeGreaterThanOrEqual(10);
    const ids = STUDIO_FONTS.map((font) => font.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STUDIO_FONTS.some((font) => font.kind === "system")).toBe(true);
    expect(STUDIO_FONTS.some((font) => font.kind === "webfont")).toBe(true);
    expect(STUDIO_FONTS.some((font) => font.kind === "local")).toBe(true);
  });

  it("resolves unknown ids to a web-safe fallback", () => {
    expect(studioFontById("not-a-font").id).toBe("arial");
  });

  it("builds a Google Fonts stylesheet URL only for OFL webfonts", () => {
    const href = studioGoogleFontsHref();
    expect(href).toContain("fonts.googleapis.com/css2");
    expect(href).toContain("Oswald");
    expect(href).toContain("Pacifico");
    expect(href).not.toContain("Arial");
  });
});
