import { describe, expect, it } from "vitest";
import { lineSnapshotTotalMinor } from "./quote-pricing";

describe("lineSnapshotTotalMinor", () => {
  it("reads a v1 breakdown total", () => {
    expect(lineSnapshotTotalMinor({ breakdown: { totalMinor: 2500 } })).toBe(
      2500,
    );
  });

  it("prefers a v2 totals nest", () => {
    expect(
      lineSnapshotTotalMinor({
        breakdown: { totalMinor: 1, totals: { totalMinor: 9900 } },
      }),
    ).toBe(9900);
  });

  it("returns undefined when nothing is stored", () => {
    expect(lineSnapshotTotalMinor(undefined)).toBeUndefined();
    expect(lineSnapshotTotalMinor({})).toBeUndefined();
  });
});
