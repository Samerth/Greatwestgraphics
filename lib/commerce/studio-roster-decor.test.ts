import { describe, expect, it } from "vitest";
import { defaultRosterDecor, RosterDecorSchema } from "@gwg/contracts";
import {
  ROSTER_DECOR_LOCATIONS,
  emptyRosterDecor,
  patchRosterDecor,
  rosterDecorSummary,
} from "./studio-roster-decor";

describe("roster names vs numbers independence", () => {
  // Both default to the same location now — matching Coastal Reign's own
  // default ("Back" / "Back") and closing real, repeated confusion in UAT
  // testing where independently-configurable defaults produced Names and
  // Numbers split across two different sides with no explanation on
  // screen. Independent placement is still fully supported (see the patch
  // test below) — only the starting point changed.
  it("starts names and numbers on the same location, at different heights", () => {
    const decor = emptyRosterDecor();
    expect(decor.names.location).toBe("Full Back");
    expect(decor.numbers.location).toBe("Full Back");
    expect(decor.names.location).toBe(decor.numbers.location);
    expect(decor.names.heightIn).not.toBe(decor.numbers.heightIn);
    expect(decor.names).not.toEqual(decor.numbers);
  });

  it("patching names does not mutate numbers, and the reverse", () => {
    const start = defaultRosterDecor();
    const namesOnly = patchRosterDecor(start, "names", {
      printMethod: "embroidery",
      color: "#c41e3a",
      heightIn: 3,
      location: "Left Chest",
    });
    expect(namesOnly.names.printMethod).toBe("embroidery");
    expect(namesOnly.names.color).toBe("#c41e3a");
    expect(namesOnly.names.heightIn).toBe(3);
    expect(namesOnly.names.location).toBe("Left Chest");
    expect(namesOnly.numbers).toEqual(start.numbers);

    const numbersOnly = patchRosterDecor(namesOnly, "numbers", {
      printMethod: "print",
      color: "#1e4bd1",
      heightIn: 10,
      location: "Full Front",
    });
    expect(numbersOnly.names).toEqual(namesOnly.names);
    expect(numbersOnly.numbers.printMethod).toBe("print");
    expect(numbersOnly.numbers.color).toBe("#1e4bd1");
    expect(numbersOnly.numbers.heightIn).toBe(10);
    expect(numbersOnly.numbers.location).toBe("Full Front");
  });

  it("includes side panels among team location options", () => {
    expect(ROSTER_DECOR_LOCATIONS).toContain("Left Side Panel");
    expect(ROSTER_DECOR_LOCATIONS).toContain("Right Side Panel");
  });

  it("summarizes each target separately for cart meta", () => {
    const decor = patchRosterDecor(defaultRosterDecor(), "numbers", {
      printMethod: "embroidery",
    });
    const summary = rosterDecorSummary(decor);
    expect(summary).toContain("Names 2.5\" print @ Full Back");
    expect(summary).toContain("Numbers 8\" embroidery @ Full Back");
  });
});

describe("the enabled toggle (Coastal Reign's '+ Names' / '+ Numbers' checkboxes)", () => {
  it("defaults both to enabled, so a fresh design shows both once named", () => {
    const decor = defaultRosterDecor();
    expect(decor.names.enabled).toBe(true);
    expect(decor.numbers.enabled).toBe(true);
  });

  it("patching enabled on one target leaves the other untouched", () => {
    const off = patchRosterDecor(defaultRosterDecor(), "numbers", {
      enabled: false,
    });
    expect(off.numbers.enabled).toBe(false);
    expect(off.names.enabled).toBe(true);
  });

  it("parses a design saved before this field existed as enabled — no design that used to show both marks silently loses one", () => {
    const legacy = {
      names: {
        printMethod: "print",
        heightIn: 2.5,
        color: "#111111",
        location: "Upper Back",
        // no `enabled`, no `offsetXNorm`/`offsetYNorm` — the exact shape a
        // design saved before either field existed would have.
      },
      numbers: {
        printMethod: "print",
        heightIn: 8,
        color: "#111111",
        location: "Full Back",
      },
    };
    const parsed = RosterDecorSchema.parse(legacy);
    expect(parsed.names.enabled).toBe(true);
    expect(parsed.numbers.enabled).toBe(true);
    expect(parsed.names.offsetXNorm).toBe(0);
    expect(parsed.names.offsetYNorm).toBe(0);
  });
});
