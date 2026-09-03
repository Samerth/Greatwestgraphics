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

  it("hides the old ink-colour count chips and quantity/ordering copy from the Design Studio", () => {
    const studio = read("components/design/DesignStudio.tsx");
    // These were the actual fingerprints of the bug this test exists for —
    // shoppers reading a screen-print ink-colour count as the garment
    // colour, and a quantity/ordering question sitting inside the studio.
    // Both stay gone.
    expect(studio).not.toContain("Colours in the design");
    expect(studio).not.toContain("Print method (optional)");
    // CodSphere UAT V2's later "Decoration Method, Location & Pricing
    // Inputs" round asks for the opposite of a blanket ban on decoration
    // pricing controls: a colour-count input, scoped per side, inside a
    // clearly labelled "Decoration — {side}" section — not the old
    // unlabelled chips in a catch-all finish panel. `colourOptions` is
    // therefore expected in the source now; what must never come back is
    // the specific old copy asserted above.
    expect(studio).toContain("colourOptions");
    expect(studio).toContain("Decoration — ");
  });

  it("keeps one garment colour switcher and the print location under the mockup", () => {
    const studio = read("components/design/DesignStudio.tsx");
    expect(studio.match(/<StudioColorSwitcher/g)).toHaveLength(1);
    expect(studio).toContain('tone="panel"');
    expect(studio).toContain('data-studio="print-location"');
    expect(studio).toContain("max-w-[min(820px,calc(100dvh-12rem))]");
  });

  it("keeps Team in the canvas column and the left pane below the header", () => {
    const studio = read("components/design/DesignStudio.tsx");
    expect(studio).toContain('id="studio-team-order"');
    // Column 3, not 2: the vertical tool rail is column 1 now, the product
    // panel column 2 and the canvas column 3 — these panels still belong
    // under the canvas they act on, which is what this guards.
    expect(studio).toContain("md:col-start-3");
    expect(studio).not.toMatch(/id="studio-team-order"[\s\S]{0,80}md:col-span-2/);
    expect(studio).toContain("md:top-[calc(var(--header-offset)+1rem)]");
    expect(studio).toContain("studioCanvasImageUrl(thumbBackdrop)");
    expect(studio).toContain("studioVisiblePlateTint");
    expect(studio).toContain("styleTitle");
  });
});
