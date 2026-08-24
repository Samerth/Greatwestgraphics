import { describe, expect, it } from "vitest";
import { DESIGN_CANVAS_SIZE } from "@gwg/contracts";
import { printAreaPixels } from "./studio-placement";
import {
  STUDIO_ZONE_INCHES,
  detectPlacementZone,
  formatZoneInchLabel,
} from "./studio-zones";

const canvas = DESIGN_CANVAS_SIZE;

function markAt(
  side: "front" | "back" | "left" | "right",
  nx: number,
  ny: number,
  width = 30,
  height = 30,
) {
  const area = printAreaPixels(side, canvas);
  return {
    side,
    x: area.x + area.width * nx - width / 2,
    y: area.y + area.height * ny - height / 2,
    width,
    height,
    canvasSize: canvas,
  };
}

describe("STUDIO_ZONE_INCHES", () => {
  it("documents the adult body plate and chest mark sizes", () => {
    expect(STUDIO_ZONE_INCHES["Full Front"]).toEqual({
      widthIn: 13,
      heightIn: 16,
    });
    expect(STUDIO_ZONE_INCHES["Full Back"]).toEqual({
      widthIn: 13,
      heightIn: 16,
    });
    expect(STUDIO_ZONE_INCHES["Left Chest"]).toEqual({
      widthIn: 5,
      heightIn: 5,
    });
    expect(STUDIO_ZONE_INCHES["Center Chest"]).toEqual({
      widthIn: 5,
      heightIn: 5,
    });
    expect(STUDIO_ZONE_INCHES["Right Chest"]).toEqual({
      widthIn: 5,
      heightIn: 5,
    });
    expect(STUDIO_ZONE_INCHES["Upper Back"]).toEqual({
      widthIn: 12,
      heightIn: 5,
    });
    expect(STUDIO_ZONE_INCHES["Left Sleeve"]).toEqual({
      widthIn: 3.5,
      heightIn: 3.5,
    });
    expect(STUDIO_ZONE_INCHES["Right Side Panel"]).toEqual({
      widthIn: 4,
      heightIn: 12,
    });
  });

  it("formats the live guide label with inch dimensions", () => {
    expect(formatZoneInchLabel("Left Chest")).toBe('Left Chest · 5"W × 5"H');
    expect(formatZoneInchLabel("Full Front")).toBe('Full Front · 13"W × 16"H');
    expect(formatZoneInchLabel("Left Sleeve")).toBe(
      'Left Sleeve · 3.5"W × 3.5"H',
    );
    expect(formatZoneInchLabel("Unknown Zone")).toBe("Unknown Zone");
  });
});

describe("detectPlacementZone", () => {
  it("splits the front plate into left / center / right chest from x/y", () => {
    expect(detectPlacementZone(markAt("front", 0.12, 0.2))).toBe("Left Chest");
    expect(detectPlacementZone(markAt("front", 0.5, 0.2))).toBe("Center Chest");
    expect(detectPlacementZone(markAt("front", 0.9, 0.2))).toBe("Right Chest");
  });

  it("promotes a wide or tall mark on the front to Full Front", () => {
    const area = printAreaPixels("front", canvas);
    expect(
      detectPlacementZone({
        side: "front",
        x: area.x,
        y: area.y,
        width: area.width * 0.7,
        height: 40,
        canvasSize: canvas,
      }),
    ).toBe("Full Front");
  });

  it("uses size on the back and sleeves", () => {
    expect(detectPlacementZone(markAt("back", 0.5, 0.2))).toBe("Upper Back");
    const back = printAreaPixels("back", canvas);
    expect(
      detectPlacementZone({
        side: "back",
        x: back.x,
        y: back.y,
        width: back.width * 0.7,
        height: 40,
        canvasSize: canvas,
      }),
    ).toBe("Full Back");
    expect(detectPlacementZone(markAt("left", 0.5, 0.2))).toBe("Left Sleeve");
    const left = printAreaPixels("left", canvas);
    expect(
      detectPlacementZone({
        side: "left",
        x: left.x,
        y: left.y,
        width: left.width * 0.7,
        height: 40,
        canvasSize: canvas,
      }),
    ).toBe("Left Side Panel");
    expect(detectPlacementZone(markAt("right", 0.5, 0.2))).toBe("Right Sleeve");
  });
});
