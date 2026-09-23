import { describe, expect, it } from "vitest";
import { redactStaffOnlyFields } from "../src/domain/staff-fields";

function detail() {
  return {
    internalNote: "Customer called about a wrong colour",
    internalNoteUpdatedAt: "2026-09-22T00:00:00Z",
    internalNoteUpdatedBy: { type: "staff" as const, displayName: "Pavin" },
    rushConfirmedBy: { type: "staff" as const, displayName: "Pavin" },
    rushConfirmedAt: "2026-09-22T00:00:00Z",
    promisedDate: "2026-09-25",
  };
}

describe("redactStaffOnlyFields", () => {
  it("returns the note and actor identities unchanged for a staff caller", () => {
    const result = redactStaffOnlyFields(detail(), { includeStaffFields: true });
    expect(result.internalNote).toBe("Customer called about a wrong colour");
    expect(result.internalNoteUpdatedBy?.displayName).toBe("Pavin");
    expect(result.rushConfirmedBy?.displayName).toBe("Pavin");
  });

  it("nulls the note and actor identities for a non-staff caller", () => {
    const result = redactStaffOnlyFields(detail(), { includeStaffFields: false });
    expect(result.internalNote).toBeNull();
    expect(result.internalNoteUpdatedAt).toBeNull();
    expect(result.internalNoteUpdatedBy).toBeNull();
    expect(result.rushConfirmedBy).toBeNull();
  });

  it("defaults to redacted when the caller omits the flag entirely", () => {
    // The important case: forgetting to opt in must fail closed, not open.
    const result = redactStaffOnlyFields(detail(), {} as { includeStaffFields: boolean });
    expect(result.internalNote).toBeNull();
  });

  it("never redacts the rush confirmation itself, only who confirmed it", () => {
    const result = redactStaffOnlyFields(detail(), { includeStaffFields: false });
    expect(result.rushConfirmedAt).toBe("2026-09-22T00:00:00Z");
    expect(result.promisedDate).toBe("2026-09-25");
  });
});
