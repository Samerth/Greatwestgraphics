import { describe, expect, it } from "vitest";
import type { Actor } from "@gwg/contracts";
import { JobRequestStatuses } from "@gwg/contracts";
import {
  assertProofDecidable,
  audienceForActor,
  defaultAudienceForAuthor,
  ProofDecisionError,
  statusForProofDecision,
  type DecidableProof,
} from "../src/domain/proof-decision.js";

const customer: Actor = { type: "customer", id: "11111111-1111-4111-8111-111111111111" };
const staff: Actor = { type: "staff", id: "22222222-2222-4222-8222-222222222222" };
const system: Actor = { type: "system" };

const pending = (awaiting: string | null): DecidableProof => ({
  version: 1,
  decision: "pending",
  awaitingDecisionFrom: awaiting,
});

describe("proof audiences", () => {
  it("puts every non-customer actor on the shop's side", () => {
    expect(audienceForActor(customer)).toBe("customer");
    expect(audienceForActor(staff)).toBe("staff");
    expect(audienceForActor(system)).toBe("staff");
  });

  it("aims a new proof at the party that did not raise it", () => {
    expect(defaultAudienceForAuthor(staff)).toBe("customer");
    expect(defaultAudienceForAuthor(customer)).toBe("staff");
  });
});

describe("assertProofDecidable", () => {
  it("lets the awaited party decide", () => {
    expect(() =>
      assertProofDecidable(pending("customer"), "approved", undefined, customer),
    ).not.toThrow();
    expect(() =>
      assertProofDecidable(pending("staff"), "approved", undefined, staff),
    ).not.toThrow();
  });

  it("refuses a verdict from the side that raised the proof", () => {
    // Without this a customer could sign off their own artwork before staff
    // had ever looked at it.
    expect(() =>
      assertProofDecidable(pending("staff"), "approved", undefined, customer),
    ).toThrow(ProofDecisionError);
    expect(() =>
      assertProofDecidable(pending("customer"), "approved", undefined, staff),
    ).toThrow(ProofDecisionError);
  });

  it("treats a proof with no recorded audience as awaiting the customer", () => {
    expect(() =>
      assertProofDecidable(pending(null), "approved", undefined, customer),
    ).not.toThrow();
    expect(() =>
      assertProofDecidable(pending(null), "approved", undefined, staff),
    ).toThrow(ProofDecisionError);
  });

  it("requires a note when asking for changes", () => {
    expect(() =>
      assertProofDecidable(pending("customer"), "changes_requested", undefined, customer),
    ).toThrow(/note is required/i);
    expect(() =>
      assertProofDecidable(pending("customer"), "changes_requested", "   ", customer),
    ).toThrow(/note is required/i);
    expect(() =>
      assertProofDecidable(pending("customer"), "changes_requested", "Logo too small", customer),
    ).not.toThrow();
  });

  it("does not require a note to approve", () => {
    expect(() =>
      assertProofDecidable(pending("customer"), "approved", undefined, customer),
    ).not.toThrow();
  });

  it("decides a proof once", () => {
    for (const already of ["approved", "changes_requested"]) {
      expect(() =>
        assertProofDecidable(
          { version: 2, decision: already, awaitingDecisionFrom: null },
          "approved",
          undefined,
          customer,
        ),
      ).toThrow(/already/i);
    }
  });
});

describe("statusForProofDecision", () => {
  it("advances a job under review and sends it back on changes", () => {
    expect(statusForProofDecision("under_review", "approved")).toBe("approved");
    expect(statusForProofDecision("under_review", "changes_requested")).toBe(
      "changes_requested",
    );
  });

  it("leaves every other status alone", () => {
    // A late decision must not rewind a job that has been paid for or
    // already released to production.
    for (const status of JobRequestStatuses) {
      if (status === "under_review") continue;
      expect(statusForProofDecision(status, "approved")).toBeNull();
      expect(statusForProofDecision(status, "changes_requested")).toBeNull();
    }
  });

  it("only produces statuses the state machine accepts from under_review", () => {
    expect(["approved", "changes_requested"]).toContain(
      statusForProofDecision("under_review", "approved"),
    );
  });
});
