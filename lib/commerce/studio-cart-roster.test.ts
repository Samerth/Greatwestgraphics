import { describe, expect, it } from "vitest";
import { defaultRosterDecor } from "@gwg/contracts";
import { patchRosterDecor, rosterDecorSummary } from "./studio-roster-decor";
import {
  cartRosterRowsFromDraft,
  cartRosterRowsFromValidatedDraft,
  studioCartLineFields,
  studioCartRosterPayload,
  studioCheckoutConfiguration,
  studioDesignNotesBit,
  studioTeamOrderQuantity,
  studioTeamRosterError,
} from "./studio-cart-roster";

const incompleteDraft = [
  { size: "M", name: "Alex", number: "12" },
  { size: "L", name: "  ", number: "99" },
  { size: "XL", name: "Sam", number: "" },
];

const teamDraft = [
  { size: "M", name: "Alex", number: "12" },
  { size: "XL", name: "Sam", number: "" },
];

const teamRows = [
  { size: "M", name: "Alex", number: "12" },
  { size: "XL", name: "Sam" },
];

describe("studio cart roster — pre-dedupe team-order contract", () => {
  it("summaries drop empty names; the cart line does not until validation fails", () => {
    expect(cartRosterRowsFromDraft(incompleteDraft)).toEqual(teamRows);
    expect(cartRosterRowsFromValidatedDraft(teamDraft)).toEqual(teamRows);
  });

  it("uses the same team-order errors as catalog PDP", () => {
    expect(studioTeamRosterError([])).toBe("Add at least one person.");
    expect(
      studioTeamRosterError([{ size: "", name: "", number: "" }]),
    ).toBe("Every row needs a name.");
    expect(studioTeamRosterError(incompleteDraft)).toBe(
      "Every row needs a name.",
    );
    expect(studioTeamRosterError(teamDraft)).toBeNull();
  });

  it("prices a team order from roster.length, same as the old finish block", () => {
    expect(studioTeamOrderQuantity(false, incompleteDraft, 48)).toBe(48);
    expect(studioTeamOrderQuantity(true, teamDraft, 48)).toBe(2);
    expect(
      studioTeamOrderQuantity(true, [{ size: "", name: "", number: "" }], 48),
    ).toBe(1);
  });

  it("does not put a roster on the cart line unless the team-order flag is checked", () => {
    const decor = defaultRosterDecor();
    const single = studioCartRosterPayload({
      teamOrder: false,
      roster: teamDraft,
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
    if (!single.ok) throw new Error("expected regular payload");
    const line = studioCartLineFields(single, {
      printLabel: "Front print",
      notes: "  Keep names small  ",
      sizeName: "L",
      designQty: 48,
    });
    expect(line.roster).toBeUndefined();
    expect(line.qty).toBe(48);
    expect(line.rosterDecor).toBe(decor);
    expect(line.meta).toBe(
      `Custom design · Size L · Front print${studioDesignNotesBit("  Keep names small  ")}`,
    );
  });

  it("checked + named rows attach roster with qty === roster.length", () => {
    const decor = patchRosterDecor(defaultRosterDecor(), "numbers", {
      printMethod: "embroidery",
    });
    const team = studioCartRosterPayload({
      teamOrder: true,
      roster: teamDraft,
      rosterDecor: decor,
    });
    expect(team).toMatchObject({
      ok: true,
      teamOrder: true,
      qty: 2,
      rosterDecor: decor,
    });
    if (!team.ok || !team.teamOrder) throw new Error("expected team payload");
    expect(team.roster).toEqual(teamRows);
    expect(team.qty).toBe(team.roster.length);
    expect(team.namesMetaBit).toBe(` · ${rosterDecorSummary(decor)}`);
    expect(team.namesMetaBit).toContain('Names 2.5" print @ Upper Back');
    expect(team.namesMetaBit).toContain('Numbers 8" embroidery @ Full Back');

    const line = studioCartLineFields(team, {
      printLabel: "Front print",
      notes: "Rush Friday",
      sizeName: "M",
      designQty: 48,
    });
    expect(line.roster).toEqual(teamRows);
    expect(line.qty).toBe(teamRows.length);
    expect(line.qty).toBe(line.roster!.length);
    expect(line.rosterDecor).toBe(decor);
    expect(line.meta).toBe(
      `Custom design · Team order · 2 pieces, mixed sizes · Front print · ${rosterDecorSummary(decor)}${studioDesignNotesBit("Rush Friday")}`,
    );
  });

  it("rejects a checked team order the same way PDP does", () => {
    expect(
      studioCartRosterPayload({
        teamOrder: true,
        roster: [{ size: "M", name: "", number: "1" }],
        rosterDecor: defaultRosterDecor(),
      }),
    ).toEqual({
      ok: false,
      error: "Every row needs a name.",
    });
  });

  it("checkout configuration copies cart roster, qty, and rosterDecor unchanged", () => {
    const decor = defaultRosterDecor();
    const team = studioCartRosterPayload({
      teamOrder: true,
      roster: teamDraft,
      rosterDecor: decor,
    });
    if (!team.ok) throw new Error("expected team payload");
    const line = studioCartLineFields(team, {
      printLabel: "Back print",
      notes: "",
      sizeName: "M",
      designQty: 24,
    });
    const configuration = studioCheckoutConfiguration({
      ...line,
      designNotes: undefined,
    });
    expect(configuration.roster).toEqual(line.roster);
    expect(configuration.quantity).toBe(line.qty);
    expect(configuration.quantity).toBe(configuration.roster!.length);
    expect(configuration.rosterDecor).toBe(decor);
    expect(configuration.productMetadata).toContain("Team order · 2 pieces");

    const regular = studioCartRosterPayload({
      teamOrder: false,
      roster: teamDraft,
      rosterDecor: decor,
    });
    if (!regular.ok) throw new Error("expected regular payload");
    const regularLine = studioCartLineFields(regular, {
      printLabel: "Back print",
      sizeName: "XL",
      designQty: 24,
    });
    const regularConfig = studioCheckoutConfiguration(regularLine);
    expect(regularConfig.roster).toBeUndefined();
    expect(regularConfig.quantity).toBe(24);
    expect(regularConfig.productMetadata).toContain("Size XL");
    expect(regularConfig.productMetadata).not.toContain("Team order");
  });
});
