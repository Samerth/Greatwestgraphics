import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const studio = readFileSync(
  resolve(process.cwd(), "components/design/DesignStudio.tsx"),
  "utf8",
);
const editor = readFileSync(
  resolve(process.cwd(), "components/design/StudioElementEditor.tsx"),
  "utf8",
);

describe("studio team-order chrome", () => {
  it("uses a Team tab and a wide panel, not a Names rail plus finish checkbox", () => {
    expect(studio).toContain('label: "Team"');
    expect(studio).toContain("StudioTeamOrderPanel");
    expect(studio).toContain("studio-team-order");
    expect(studio).not.toContain("Team/group order — use the Names roster");
    expect(studio).not.toContain("Open Names tab");
    expect(studio).not.toContain("StudioNamesNumbersTab");
  });
});

describe("studio side thumbs carry the selected layer", () => {
  it("drops the Move design location block and moves from the garment thumbs", () => {
    expect(editor).not.toContain("Move design location");
    expect(editor).not.toContain("onMoveToSide");
    expect(studio).not.toContain("onMoveToSide");
    expect(studio).toContain("moveSelectedToSide");
    expect(studio).toContain("if (selectedId && side !== activeSide)");
  });
});
