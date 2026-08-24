import { describe, expect, it } from "vitest";
import { defaultRosterDecor } from "@gwg/contracts";
import { patchRosterDecor } from "./studio-roster-decor";
import {
  cartRosterRowsFromDraft,
  studioCartRosterPayload,
  studioTeamOrderQuantity,
  studioTeamRosterError,
} from "./studio-cart-roster";

const draft = [
  { size: "M", name: "Alex", number: "12" },
  { size: "L", name: "  ", number: "99" },
  { size: "XL", name: "Sam", number: "" },
];

describe("studio cart roster — Names tab is the source of truth", () => {
  it("drops empty placeholder rows and trims name / number", () => {
    expect(cartRosterRowsFromDraft(draft)).toEqual([
      { size: "M", name: "Alex", number: "12" },
      { size: "XL", name: "Sam" },
    ]);
  });

  it("requires at least one named row for a team order", () => {
    expect(
      studioTeamRosterError([{ size: "", name: "", number: "" }]),
    ).toBe("Add at least one name in the Names tab.");
    expect(studioTeamRosterError(draft)).toBeNull();
  });

  it("prices team-order quantity from named Names-tab rows, not empty placeholders", () => {
    expect(studioTeamOrderQuantity(false, draft, 48)).toBe(48);
    expect(studioTeamOrderQuantity(true, draft, 48)).toBe(2);
    expect(
      studioTeamOrderQuantity(true, [{ size: "", name: "", number: "" }], 48),
    ).toBe(1);
  });

  it("does not put a roster on the cart line unless team order is on", () => {
    const decor = defaultRosterDecor();
    const single = studioCartRosterPayload({
      teamOrder: false,
      roster: draft,
      rosterDecor: decor,
    });
    expect(single).toEqual({
      ok: true,
      teamOrder: false,
      roster: undefined,
      rosterDecor: decor,
      namesMetaBit: "",
      qty: null,
    });
  });

  it("fills roster, qty, rosterDecor, and meta from the Names tab when team order is on", () => {
    const decor = patchRosterDecor(defaultRosterDecor(), "numbers", {
      printMethod: "embroidery",
    });
    const team = studioCartRosterPayload({
      teamOrder: true,
      roster: draft,
      rosterDecor: decor,
    });
    expect(team).toMatchObject({
      ok: true,
      teamOrder: true,
      qty: 2,
      rosterDecor: decor,
    });
    if (!team.ok || !team.teamOrder) throw new Error("expected team payload");
    expect(team.roster).toEqual([
      { size: "M", name: "Alex", number: "12" },
      { size: "XL", name: "Sam" },
    ]);
    expect(team.namesMetaBit).toContain('Names 2.5" print @ Upper Back');
    expect(team.namesMetaBit).toContain('Numbers 8" embroidery @ Full Back');
  });

  it("rejects a team order with no names so the cart cannot drop the roster", () => {
    expect(
      studioCartRosterPayload({
        teamOrder: true,
        roster: [{ size: "M", name: "", number: "1" }],
        rosterDecor: defaultRosterDecor(),
      }),
    ).toEqual({
      ok: false,
      error: "Add at least one name in the Names tab.",
    });
  });
});
