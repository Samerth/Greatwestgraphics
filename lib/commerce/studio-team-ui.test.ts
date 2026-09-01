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
const rosterEditor = readFileSync(
  resolve(process.cwd(), "components/shared/RosterEditor.tsx"),
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

describe("studio side thumbs only ever switch the view", () => {
  // Reverses the prior "redundant Move design location block" removal
  // (948fd57): consolidating move-on-click into the side thumbnails meant
  // uploading art on Front, then clicking through Back/L.Sleeve/R.Sleeve to
  // add more, silently relocated that one piece of art each time instead of
  // adding new art per side — confirmed against a live UAT test, not just
  // a hypothetical. Moving is deliberately its own explicit control again,
  // and a thumbnail click never has a side effect beyond changing the view.
  it("keeps moving as an explicit 'Move to' control, not a thumbnail click side effect", () => {
    expect(editor).toContain("moveTo");
    expect(editor).toContain("Move to");
    expect(studio).toContain("moveSelectedToSide");
    expect(studio).not.toContain("if (selectedId && side !== activeSide)");
  });
});

describe("studio sleeve representation caption", () => {
  it("mentions representation only on photorealistic side plates", () => {
    expect(studio).toContain("isStudioSideRepresentation");
    expect(studio).toContain('data-studio="sleeve-representation"');
    expect(studio).toContain("This side view is for representation only.");
    expect(studio).toContain("sleeveView && isStudioSideRepresentation(backdrop)");
  });
});

describe("studio layer editor chrome", () => {
  it("labels z-order and copy/remove so they are not garment views", () => {
    expect(editor).toContain("Bring forward");
    expect(editor).toContain("Send backward");
    expect(editor).toContain("Bring this layer in front of the others");
    expect(editor).toContain("Send this layer behind the others");
    expect(editor).toContain("Copy the selected artwork or text");
    expect(editor).toContain("Remove the selected artwork or text");
    expect(editor).toContain("Duplicate");
    expect(editor).toContain("Delete");
  });
});

describe("studio team roster chrome", () => {
  it("counts started rows and fills sizes when a name is typed", () => {
    expect(rosterEditor).toContain("No team shirts yet");
    expect(rosterEditor).toContain("wideRosterCountLabel");
    expect(studio).toContain("withDefaultRosterSizes(rows, defaultRosterSize)");
    expect(studio).toContain("studioRosterSizeOptions");
    expect(studio).toContain("studioActiveTeamRows");
  });
});
