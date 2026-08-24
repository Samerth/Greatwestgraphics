import { describe, expect, it } from "vitest";
import { defaultRosterDecor } from "@gwg/contracts";
import {
  emptyRosterDecor,
  patchRosterDecor,
  rosterDecorSummary,
} from "./studio-roster-decor";

describe("roster names vs numbers independence", () => {
  it("starts names and numbers on different locations and heights", () => {
    const decor = emptyRosterDecor();
    expect(decor.names.location).toBe("Upper Back");
    expect(decor.numbers.location).toBe("Full Back");
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

  it("summarizes each target separately for cart meta", () => {
    const decor = patchRosterDecor(defaultRosterDecor(), "numbers", {
      printMethod: "embroidery",
    });
    const summary = rosterDecorSummary(decor);
    expect(summary).toContain("Names 2.5\" print @ Upper Back");
    expect(summary).toContain("Numbers 8\" embroidery @ Full Back");
  });
});
