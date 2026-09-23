import { describe, expect, it } from "vitest";
import { rosterMissingNameError, type RosterNameRow } from "./roster-validation";

const row = (name: string, number = ""): RosterNameRow => ({ name, number });

describe("rosterMissingNameError — default (skipBlankRows: true, the Studio's roster)", () => {
  it("is fine when nothing has been started yet — an untouched roster must not block a non-team design", () => {
    expect(rosterMissingNameError([row("", "")])).toBeNull();
    expect(rosterMissingNameError([])).toBeNull();
  });

  it("catches a number typed with no name", () => {
    expect(rosterMissingNameError([row("", "07")])).toBe("Every row needs a name.");
  });

  it("is fine once every started row has a name", () => {
    expect(rosterMissingNameError([row("Alex", "07"), row("Sam")])).toBeNull();
  });

  it("catches one bad row even among otherwise-good ones", () => {
    expect(
      rosterMissingNameError([row("Alex", "07"), row("", "12"), row("Sam")]),
    ).toBe("Every row needs a name.");
  });

  it("ignores a genuinely untouched row sitting alongside real ones", () => {
    expect(rosterMissingNameError([row("Alex", "07"), row("", "")])).toBeNull();
  });
});

describe("rosterMissingNameError — skipBlankRows: false (the product page's team-order flow)", () => {
  it("catches a still-blank row once team-order mode is on, unlike the default mode", () => {
    expect(
      rosterMissingNameError([row("", "")], { skipBlankRows: false }),
    ).toBe("Every row needs a name.");
  });

  it("is fine with no rows at all — that's the caller's separate 'add at least one person' check", () => {
    expect(rosterMissingNameError([], { skipBlankRows: false })).toBeNull();
  });

  it("is fine once every row has a name", () => {
    expect(
      rosterMissingNameError([row("Alex", "07"), row("Sam")], { skipBlankRows: false }),
    ).toBeNull();
  });
});
