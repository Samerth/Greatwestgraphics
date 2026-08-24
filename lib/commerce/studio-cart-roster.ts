import type { RosterDecor } from "@gwg/contracts";
import { rosterDecorSummary } from "@/lib/commerce/studio-roster-decor";

/** Draft row from the Names tab editor (empty placeholders are allowed). */
export type StudioRosterDraftRow = {
  size: string;
  name: string;
  number: string;
};

/** Cart / checkout / admin roster row. `qty` on the line equals this array's length. */
export type StudioCartRosterRow = {
  size: string;
  name: string;
  number?: string;
};

export function cartRosterRowsFromDraft(
  rows: StudioRosterDraftRow[],
): StudioCartRosterRow[] {
  return rows
    .filter((row) => row.name.trim())
    .map((row) => ({
      size: row.size,
      name: row.name.trim(),
      number: row.number.trim() || undefined,
    }));
}

export function studioTeamRosterError(
  rows: StudioRosterDraftRow[],
): string | null {
  if (cartRosterRowsFromDraft(rows).length === 0) {
    return "Add at least one name in the Names tab.";
  }
  return null;
}

export function studioTeamOrderQuantity(
  teamOrder: boolean,
  roster: StudioRosterDraftRow[],
  designQty: number,
): number {
  if (!teamOrder) return designQty;
  return Math.max(1, cartRosterRowsFromDraft(roster).length);
}

/**
 * Maps the Names tab (and the slim team-order flag) onto the cart fields the
 * finish-block checkbox used to fill. One source of truth — no second roster.
 */
export function studioCartRosterPayload(input: {
  teamOrder: boolean;
  roster: StudioRosterDraftRow[];
  rosterDecor: RosterDecor;
}):
  | { ok: false; error: string }
  | {
      ok: true;
      teamOrder: false;
      roster: undefined;
      rosterDecor: RosterDecor;
      namesMetaBit: "";
      qty: null;
    }
  | {
      ok: true;
      teamOrder: true;
      roster: StudioCartRosterRow[];
      rosterDecor: RosterDecor;
      namesMetaBit: string;
      qty: number;
    } {
  if (!input.teamOrder) {
    return {
      ok: true,
      teamOrder: false,
      roster: undefined,
      rosterDecor: input.rosterDecor,
      namesMetaBit: "",
      qty: null,
    };
  }
  const error = studioTeamRosterError(input.roster);
  if (error) return { ok: false, error };
  const roster = cartRosterRowsFromDraft(input.roster);
  return {
    ok: true,
    teamOrder: true,
    roster,
    rosterDecor: input.rosterDecor,
    namesMetaBit: ` · ${rosterDecorSummary(input.rosterDecor)}`,
    qty: roster.length,
  };
}
