import type { RosterDecor } from "@gwg/contracts";
import { rosterDecorSummary } from "./studio-roster-decor";

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

export type StudioCartRosterPayload =
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
    };

/**
 * Maps the Names tab (and the slim team-order flag) onto the cart fields the
 * finish-block checkbox used to fill. One source of truth — no second roster.
 *
 * The flag is the only switch. A filled Names tab does not attach a roster
 * unless Team/group order is checked — same as the pre-dedupe checkbox.
 */
export function studioCartRosterPayload(input: {
  teamOrder: boolean;
  roster: StudioRosterDraftRow[];
  rosterDecor: RosterDecor;
}): StudioCartRosterPayload {
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

/** Pre-dedupe notes suffix on cart `meta`. */
export function studioDesignNotesBit(notes: string | undefined): string {
  const trimmed = (notes ?? "").trim();
  return trimmed ? ` · Note: ${trimmed.slice(0, 80)}` : "";
}

/**
 * Cart line fields checkout / admin already read. Same shape the finish-block
 * checkbox wrote before the Names-tab dedupe — do not add a new checkout step.
 */
export function studioCartLineFields(
  payload: Extract<StudioCartRosterPayload, { ok: true }>,
  input: {
    printLabel: string;
    notes?: string;
    sizeName: string;
    designQty: number;
  },
): {
  roster: StudioCartRosterRow[] | undefined;
  qty: number;
  rosterDecor: RosterDecor;
  meta: string;
} {
  const notesBit = studioDesignNotesBit(input.notes);
  if (!payload.teamOrder) {
    return {
      roster: undefined,
      qty: input.designQty,
      rosterDecor: payload.rosterDecor,
      meta: `Custom design · Size ${input.sizeName} · ${input.printLabel}${notesBit}`,
    };
  }
  return {
    roster: payload.roster,
    qty: payload.qty,
    rosterDecor: payload.rosterDecor,
    meta: `Custom design · Team order · ${payload.qty} pieces, mixed sizes · ${input.printLabel}${payload.namesMetaBit}${notesBit}`,
  };
}

/**
 * Job-request `configuration` fields checkout copies from a studio cart line.
 * Presence of `roster` (and `quantity === roster.length`) is the team-order
 * signal — same as catalog PDP team orders.
 */
export function studioCheckoutConfiguration(line: {
  meta: string;
  qty: number;
  roster?: StudioCartRosterRow[];
  rosterDecor?: RosterDecor;
  designNotes?: string;
}): {
  productMetadata: string;
  roster: StudioCartRosterRow[] | undefined;
  rosterDecor: RosterDecor | undefined;
  designNotes: string | undefined;
  quantity: number;
} {
  return {
    productMetadata: line.meta,
    roster: line.roster,
    rosterDecor: line.rosterDecor,
    designNotes: line.designNotes,
    quantity: line.qty,
  };
}
