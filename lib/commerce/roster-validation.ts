/** The two fields this check cares about — deliberately not the full
 *  `RosterRow` shape (which also carries `size`), so this stays usable
 *  wherever a roster row's name and number exist, size or not. */
export type RosterNameRow = { name: string; number: string };

/**
 * The one rule a team-order roster has to satisfy before it can leave a
 * page and become part of a real order: every row that counts needs a
 * name. A number with no name (or a row left entirely blank) has nothing
 * for the print floor to put on the garment.
 *
 * Returns the message to show, or `null` when the roster is fine. Shared
 * so the product page's own team-order flow and the Design Studio's roster
 * enforce the exact same rule, worded the same way — before this, only the
 * product page checked at all (UAT audit: "Team rosters are never
 * validated").
 *
 * `skipBlankRows` (default true) decides what "counts": the Studio's
 * roster tab exists on every design whether or not it's actually a team
 * order, starting with one placeholder row — checking that untouched row
 * would block every ordinary, non-team design, so only rows the customer
 * actually started (typed a name or a number into) count there. The
 * product page's roster only exists once "this is a team order" has
 * already been ticked, so there every row counts, including a still-blank
 * one — the customer said this was a roster, so an empty one is the bug.
 */
export function rosterMissingNameError(
  rows: readonly RosterNameRow[],
  options?: { skipBlankRows?: boolean },
): string | null {
  const skipBlankRows = options?.skipBlankRows ?? true;
  const candidates = skipBlankRows
    ? rows.filter((row) => row.name.trim() || row.number.trim())
    : rows;
  if (candidates.length === 0) return null;
  if (candidates.some((row) => !row.name.trim())) return "Every row needs a name.";
  return null;
}
