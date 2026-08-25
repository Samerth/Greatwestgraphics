import type { RosterDecor } from "@gwg/contracts";
import { moneyFromMinor } from "../utils/quote-pricing";
import { rosterDecorSummary } from "./studio-roster-decor";

/** Draft row from the Team order panel (empty placeholders are allowed). */
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

/** Named rows only — used for the finish-block summary, not the cart qty. */
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

/** Size-only leftovers from "+ Add person" are not part of the order. */
export function studioActiveTeamRows(
  rows: StudioRosterDraftRow[],
): StudioRosterDraftRow[] {
  return rows.filter((row) => row.name.trim() || row.number.trim());
}

/** Same mapping the pre-dedupe finish block wrote after validation. */
export function cartRosterRowsFromValidatedDraft(
  rows: StudioRosterDraftRow[],
): StudioCartRosterRow[] {
  return studioActiveTeamRows(rows).map((row) => ({
    size: row.size,
    name: row.name.trim(),
    number: row.number.trim() || undefined,
  }));
}

/**
 * Fill blank size cells once the garment's size list is known. The first
 * studio row starts empty; a native <select> then looks chosen while React
 * still holds "".
 */
export function withDefaultRosterSizes(
  rows: StudioRosterDraftRow[],
  defaultSize: string,
): StudioRosterDraftRow[] {
  const size = defaultSize.trim();
  if (!size) return rows;
  let changed = false;
  const next = rows.map((row) => {
    if (row.size.trim()) return row;
    changed = true;
    return { ...row, size };
  });
  return changed ? next : rows;
}

/**
 * Same rules as catalog PDP and the pre-dedupe studio checkbox:
 * at least one player row, and every player row needs a name and size.
 * Empty placeholder rows are ignored so "+ Add person" does not block cart.
 */
export function studioTeamRosterError(
  rows: StudioRosterDraftRow[],
): string | null {
  const active = studioActiveTeamRows(rows);
  if (active.length === 0) {
    return "Add at least one person.";
  }
  if (active.some((row) => !row.name.trim())) {
    return "Every row needs a name.";
  }
  if (active.some((row) => !row.size.trim())) {
    return "Every row needs a size.";
  }
  return null;
}

/** A complete roster is a team order. One name on a jersey belongs on Text. */
export function studioIsCompleteTeamRoster(
  rows: StudioRosterDraftRow[],
): boolean {
  return studioTeamRosterError(rows) === null;
}

export function studioHasStartedTeamRoster(
  rows: StudioRosterDraftRow[],
): boolean {
  return cartRosterRowsFromDraft(rows).length > 0;
}

/** Finish-block mode. The default empty row stays bulk Size/Qty. */
export type StudioFinishMode = "bulk" | "team-progress" | "team-ready";

export function studioFinishMode(
  rows: StudioRosterDraftRow[],
): StudioFinishMode {
  if (!studioHasStartedTeamRoster(rows)) return "bulk";
  if (studioIsCompleteTeamRoster(rows)) return "team-ready";
  return "team-progress";
}

export function studioTeamOrderQuantity(
  roster: StudioRosterDraftRow[],
  designQty: number,
): number {
  if (!studioIsCompleteTeamRoster(roster)) return designQty;
  return Math.max(1, studioActiveTeamRows(roster).length);
}

/** Live quote qty: named rows while the list is in progress, else bulk qty. */
export function studioTeamQuoteQuantity(
  roster: StudioRosterDraftRow[],
  designQty: number,
): number {
  if (studioIsCompleteTeamRoster(roster)) {
    return Math.max(1, studioActiveTeamRows(roster).length);
  }
  const named = cartRosterRowsFromDraft(roster).length;
  if (named > 0) return named;
  return designQty;
}

/** Team and bulk share one CTA shape: qty · placement · quoted dollars. */
export function studioFinishCtaLabel(input: {
  quoteQty: number;
  placementSuffix: string;
  totalMinor: number;
}): string {
  const pieces = `Add ${input.quoteQty.toLocaleString()} Piece${
    input.quoteQty === 1 ? "" : "s"
  } to Cart`;
  return `${pieces} · ${input.placementSuffix} · ${moneyFromMinor(input.totalMinor)}`;
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
 * A finished Team order panel is the only studio switch. Empty / placeholder
 * rows stay a regular size+qty line. A started-but-incomplete roster errors
 * so we do not silently drop names. Checkout still reads `roster` + qty.
 */
export function studioCartRosterPayload(input: {
  roster: StudioRosterDraftRow[];
  rosterDecor: RosterDecor;
}): StudioCartRosterPayload {
  if (!studioHasStartedTeamRoster(input.roster)) {
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
  const roster = cartRosterRowsFromValidatedDraft(input.roster);
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
