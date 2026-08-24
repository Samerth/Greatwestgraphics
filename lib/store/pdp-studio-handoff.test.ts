import { describe, expect, it } from "vitest";
import { rosterLooksStarted } from "./pdp-studio-handoff";

describe("pdp studio handoff", () => {
  it("treats empty placeholder rows as no work", () => {
    expect(
      rosterLooksStarted([{ size: "M", name: "", number: "" }]),
    ).toBe(false);
  });

  it("keeps a roster the shopper started typing on the product page", () => {
    expect(
      rosterLooksStarted([{ size: "M", name: "Alex", number: "12" }]),
    ).toBe(true);
    expect(
      rosterLooksStarted([{ size: "L", name: "", number: "9" }]),
    ).toBe(true);
  });
});
