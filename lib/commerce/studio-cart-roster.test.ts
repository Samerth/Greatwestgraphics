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
  studioHasStartedTeamRoster,
  studioIsCompleteTeamRoster,
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

const emptyDraft = [{ size: "", name: "", number: "" }];

describe("studio cart roster — team panel is the order switch", () => {
  it("summaries drop empty names; validated lines keep every row", () => {
    expect(cartRosterRowsFromDraft(incompleteDraft)).toEqual(teamRows);
    expect(cartRosterRowsFromValidatedDraft(teamDraft)).toEqual(teamRows);
  });

  it("uses the same team-order errors as catalog PDP", () => {
    expect(studioTeamRosterError([])).toBe("Add at least one person.");
    expect(studioTeamRosterError(emptyDraft)).toBe("Every row needs a name.");
    expect(studioTeamRosterError(incompleteDraft)).toBe(
      "Every row needs a name.",
    );
    expect(studioTeamRosterError(teamDraft)).toBeNull();
    expect(studioIsCompleteTeamRoster(teamDraft)).toBe(true);
    expect(studioIsCompleteTeamRoster(emptyDraft)).toBe(false);
    expect(studioHasStartedTeamRoster(emptyDraft)).toBe(false);
    expect(studioHasStartedTeamRoster(incompleteDraft)).toBe(true);
  });

  it("prices a complete team roster from roster.length", () => {
    expect(studioTeamOrderQuantity(emptyDraft, 48)).toBe(48);
    expect(studioTeamOrderQuantity(teamDraft, 48)).toBe(2);
  });

  it("empty Team panel stays a regular size + qty line", () => {
    const decor = defaultRosterDecor();
    const single = studioCartRosterPayload({
      roster: emptyDraft,
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
    expect(line.meta).toBe(
      `Custom design · Size L · Front print${studioDesignNotesBit("  Keep names small  ")}`,
    );
  });

  it("a complete roster attaches roster with qty === roster.length", () => {
    const decor = patchRosterDecor(defaultRosterDecor(), "numbers", {
      printMethod: "embroidery",
    });
    const team = studioCartRosterPayload({
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

    const line = studioCartLineFields(team, {
      printLabel: "Front print",
      notes: "Rush Friday",
      sizeName: "M",
      designQty: 48,
    });
    expect(line.roster).toEqual(teamRows);
    expect(line.qty).toBe(teamRows.length);
    expect(line.meta).toBe(
      `Custom design · Team order · 2 pieces, mixed sizes · Front print · ${rosterDecorSummary(decor)}${studioDesignNotesBit("Rush Friday")}`,
    );
  });

  it("rejects a started roster with a blank name so names are not dropped", () => {
    expect(
      studioCartRosterPayload({
        roster: incompleteDraft,
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

    const regular = studioCartRosterPayload({
      roster: emptyDraft,
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
    expect(regularConfig.productMetadata).not.toContain("Team order");
  });
});
