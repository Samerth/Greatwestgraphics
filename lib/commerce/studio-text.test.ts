import { describe, expect, it } from "vitest";
import {
  DESIGN_CANVAS_SIZE,
  emptyDesignDocument,
  type PlacedArtwork,
} from "@gwg/contracts";
import {
  alignStudioLayer,
  createStudioTextLayer,
  estimateTextDisplaySize,
  duplicateStudioLayer,
  moveStudioLayerToSide,
  nudgeStudioLayerOrder,
  studioTextArcSvgPath,
} from "./studio-text";
import { frontChestGuideRects, placementAreaPixels } from "./studio-placement";

const artwork = (id: string): PlacedArtwork => ({
  id,
  src: "https://cdn.example.com/logo.png",
  x: 120,
  y: 100,
  scaleX: 0.2,
  scaleY: 0.2,
  rotation: 0,
});

describe("createStudioTextLayer", () => {
  it("creates a text layer on the current side with defaults", () => {
    const layer = createStudioTextLayer({
      side: "front",
      text: "Hawks",
      id: "t1",
      canvasSize: DESIGN_CANVAS_SIZE,
      zone: "Center Chest",
    });
    expect(layer.id).toBe("t1");
    expect(layer.text).toBe("Hawks");
    expect(layer.align).toBe("center");
    expect(layer.printMethod).toBe("print");
    expect(layer.fontFamily).toBe("arial");
    expect(layer.fill).toBe("#111111");
    expect(layer.x).toBeGreaterThan(0);
    expect(layer.y).toBeGreaterThan(0);
    expect(layer.rotation).toBe(0);
    const box = placementAreaPixels(
      "front",
      "Center Chest",
      DESIGN_CANVAS_SIZE,
    );
    const display = estimateTextDisplaySize(layer.text, layer.fontSize);
    const midX = layer.x + display.width / 2;
    expect(midX).toBeCloseTo(box.x + box.width / 2, 5);
    expect(layer.y).toBeGreaterThanOrEqual(box.y - 0.01);
    expect(layer.y).toBeLessThan(box.y + box.height);
  });

  it("keeps per-text print method and alignment when provided", () => {
    const layer = createStudioTextLayer({
      side: "back",
      text: "12",
      id: "num",
      printMethod: "embroidery",
      align: "right",
      fill: "#c41e3a",
      fontFamily: "impact",
    });
    expect(layer.printMethod).toBe("embroidery");
    expect(layer.align).toBe("right");
    expect(layer.fill).toBe("#c41e3a");
    expect(layer.fontFamily).toBe("impact");
  });
});

describe("alignStudioLayer", () => {
  it("moves a front layer into the matching 5×5 chest box", () => {
    const start = emptyDesignDocument();
    start.artworksBySide.front = [artwork("art-align")];
    const canvas = DESIGN_CANVAS_SIZE;
    const left = alignStudioLayer(start, "art-align", "left", canvas, 30, 30);
    const center = alignStudioLayer(start, "art-align", "center", canvas, 30, 30);
    const right = alignStudioLayer(start, "art-align", "right", canvas, 30, 30);
    const boxes = frontChestGuideRects();
    const leftBox = boxes.find((box) => box.zone === "Left Chest")!.rect;
    const centerBox = boxes.find((box) => box.zone === "Center Chest")!.rect;
    const rightBox = boxes.find((box) => box.zone === "Right Chest")!.rect;
    expect(left.placementBySide.front).toBe("Left Chest");
    expect(center.placementBySide.front).toBe("Center Chest");
    expect(right.placementBySide.front).toBe("Right Chest");
    const leftLayer = left.artworksBySide.front[0]!;
    const centerLayer = center.artworksBySide.front[0]!;
    const rightLayer = right.artworksBySide.front[0]!;
    expect(leftLayer.x).toBeGreaterThanOrEqual(leftBox.x * canvas - 0.01);
    expect(leftLayer.x).toBeLessThan(centerLayer.x);
    expect(centerLayer.x).toBeGreaterThanOrEqual(centerBox.x * canvas - 0.01);
    expect(rightLayer.x).toBeGreaterThan(centerLayer.x);
    expect(rightLayer.x).toBeGreaterThanOrEqual(rightBox.x * canvas - 0.01);
    expect(leftLayer.y).toBeCloseTo(centerLayer.y, 5);
  });
});

describe("moveStudioLayerToSide", () => {
  it("moves a text layer to another side and updates the landing zone", () => {
    const text = createStudioTextLayer({
      side: "front",
      text: "Hawks",
      id: "t-move",
      zone: "Left Chest",
    });
    const start = emptyDesignDocument();
    start.textsBySide.front = [text];
    start.placementBySide.front = "Left Chest";

    const moved = moveStudioLayerToSide(start, "t-move", "back");
    expect(moved.fromSide).toBe("front");
    expect(moved.kind).toBe("text");
    expect(moved.document.textsBySide.front).toEqual([]);
    expect(moved.document.textsBySide.back.map((layer) => layer.id)).toEqual([
      "t-move",
    ]);
    expect(moved.document.textsBySide.back[0]?.text).toBe("Hawks");
    expect(moved.document.placementBySide.back).toBeTruthy();
  });

  it("moves artwork the same way", () => {
    const start = emptyDesignDocument();
    start.artworksBySide.front = [artwork("art-1")];
    const moved = moveStudioLayerToSide(start, "art-1", "left");
    expect(moved.kind).toBe("artwork");
    expect(moved.document.artworksBySide.front).toEqual([]);
    expect(moved.document.artworksBySide.left.map((layer) => layer.id)).toEqual([
      "art-1",
    ]);
  });

  it("is a no-op when the layer is already on that side", () => {
    const text = createStudioTextLayer({ side: "right", id: "stay" });
    const start = emptyDesignDocument();
    start.textsBySide.right = [text];
    const moved = moveStudioLayerToSide(start, "stay", "right");
    expect(moved.fromSide).toBe("right");
    expect(moved.document.textsBySide.right).toHaveLength(1);
  });
});

describe("studio layer chrome", () => {
  it("brings a layer forward, sends it backward, and duplicates on top", () => {
    const start = emptyDesignDocument();
    start.artworksBySide.front = [
      { ...artwork("under"), zIndex: 1 },
      { ...artwork("over"), zIndex: 2 },
    ];
    const forward = nudgeStudioLayerOrder(start, "under", "forward");
    expect(forward.artworksBySide.front.find((item) => item.id === "under")?.zIndex).toBe(3);
    const back = nudgeStudioLayerOrder(start, "over", "back");
    expect(back.artworksBySide.front.find((item) => item.id === "over")?.zIndex).toBe(0);
    const copied = duplicateStudioLayer(start, "under", "copy");
    expect(copied.duplicateId).toBe("copy");
    expect(
      copied.document.artworksBySide.front.find((item) => item.id === "copy")?.zIndex,
    ).toBe(3);
  });
});

describe("studioTextArcSvgPath", () => {
  it("returns a straight baseline when arc is ~0", () => {
    expect(studioTextArcSvgPath(100, 0)).toBe("M 0 0 L 100 0");
    expect(studioTextArcSvgPath(100, 0.4)).toBe("M 0 0 L 100 0");
  });

  it("returns a quadratic that bulges up for a positive arc", () => {
    const path = studioTextArcSvgPath(120, 60);
    expect(path.startsWith("M 0 0 Q ")).toBe(true);
    const controlY = Number(path.split(" ")[5]);
    expect(controlY).toBeLessThan(0);
  });
});
