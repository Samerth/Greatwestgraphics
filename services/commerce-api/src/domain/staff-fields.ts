import type { JobRequestDetailResponse } from "@gwg/contracts";

/** The parts of a job detail response that only staff may ever see, and
 *  which party asked for it — kept structural rather than importing the
 *  full response type so this rule is exercisable without a database. */
export type StaffOnlyFields = Pick<
  JobRequestDetailResponse,
  "internalNote" | "internalNoteUpdatedAt" | "internalNoteUpdatedBy" | "rushConfirmedBy"
>;

/**
 * `JobRequestService.get()` answers both the staff inbox and the customer
 * portal — the same query, the same mapping, the same response shape. That
 * is precisely why the internal note cannot simply live on the response:
 * without an explicit flag, it ships to whichever caller asked, customer
 * included.
 *
 * The flag is default-deny on purpose. `customerPersonId` looks like a safe
 * "this is a customer" signal but is not one — it comes back `undefined`
 * for a team-store owner reading their own account, who is a legitimate
 * caller of the very same customer route. Keying redaction off "was a
 * person id passed" would leak the note to every store owner; keying it off
 * an explicit `includeStaffFields` that only the internal staff route ever
 * sets to `true` cannot make that mistake by omission.
 *
 * Rush confirmation itself (`rushConfirmedAt`, `promisedDate`) is *not*
 * redacted here — a customer learning their rush date is confirmed is
 * useful to them, and the portal may show it later. Only the note and the
 * actor identities who touched it are staff-only.
 */
export function redactStaffOnlyFields<T extends StaffOnlyFields>(
  detail: T,
  options: { includeStaffFields: boolean },
): T {
  if (options.includeStaffFields) return detail;
  return {
    ...detail,
    internalNote: null,
    internalNoteUpdatedAt: null,
    internalNoteUpdatedBy: null,
    rushConfirmedBy: null,
  };
}
