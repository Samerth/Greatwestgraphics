import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHOW_DESIGN_STUDIO_AI_CONCEPT,
  SHOW_PUBLIC_QUOTE_CALCULATOR,
} from "./features";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("hidden shopper chrome", () => {
  it("gates header and footer quote calculator CTAs", () => {
    expect(SHOW_PUBLIC_QUOTE_CALCULATOR).toBe(false);
    const header = read("components/layout/Header.tsx");
    const footer = read("components/layout/Footer.tsx");
    expect(header).toContain("SHOW_PUBLIC_QUOTE_CALCULATOR");
    expect(footer).toContain("SHOW_PUBLIC_QUOTE_CALCULATOR");
    expect(footer).toContain("withoutPublicQuoteLinks");
  });

  it("gates the Design Studio AI concept control", () => {
    expect(SHOW_DESIGN_STUDIO_AI_CONCEPT).toBe(false);
    const studio = read("components/design/DesignStudio.tsx");
    const designPage = read("app/(shop)/design/page.tsx");
    expect(studio).toContain("SHOW_DESIGN_STUDIO_AI_CONCEPT");
    expect(studio).toContain("Generate an AI concept");
    expect(designPage).not.toMatch(/sample AI concept/i);
  });

  it("hides ink-colour count chips from the Design Studio finish panel", () => {
    const studio = read("components/design/DesignStudio.tsx");
    expect(studio).not.toContain("Colours in the design");
    expect(studio).not.toMatch(/\bcolourOptions\b/);
    expect(studio).toContain("Print method (optional)");
    expect(studio).toContain("defaultColours");
  });
});
