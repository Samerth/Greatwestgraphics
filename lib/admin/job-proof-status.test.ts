import { describe, expect, it } from "vitest";
import { proofStateFor, summarizeJobProofs } from "@/lib/admin/job-proof-status";

function proof(overrides: Partial<Parameters<typeof proofStateFor>[0]> = {}) {
  return {
    version: 1,
    decision: null,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    awaitingDecisionFrom: "customer" as const,
    note: null,
    createdAt: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

describe("proofStateFor", () => {
  it("reads as not uploaded when there is no proof at all", () => {
    expect(proofStateFor(null).state).toBe("not_uploaded");
  });

  it("reads as sent when a proof is out and the customer hasn't decided", () => {
    expect(proofStateFor(proof({ awaitingDecisionFrom: "customer" })).state).toBe("sent");
  });

  it("reads as needing staff when the round trip is waiting on the studio", () => {
    expect(proofStateFor(proof({ awaitingDecisionFrom: "staff" })).state).toBe("needs_staff");
  });

  it("reads as approved once decided approved, regardless of who was awaited", () => {
    expect(
      proofStateFor(proof({ decision: "approved", awaitingDecisionFrom: "staff" })).state,
    ).toBe("approved");
  });

  it("reads as revision requested when changes were asked for", () => {
    expect(proofStateFor(proof({ decision: "changes_requested" })).state).toBe("revision");
  });

  it("defaults a legacy proof with neither decision nor awaiting party to sent", () => {
    expect(proofStateFor(proof({ decision: null, awaitingDecisionFrom: null })).state).toBe(
      "sent",
    );
  });
});

describe("summarizeJobProofs", () => {
  it("reads the newest version's state as current, regardless of array order", () => {
    const v1 = proof({ version: 1, decision: "changes_requested" });
    const v2 = proof({ version: 2, decision: "approved" });
    const result = summarizeJobProofs([v1, v2]);
    expect(result.current.state).toBe("approved");
    expect(result.versions[0]?.version).toBe(2);
    expect(result.versions[1]?.version).toBe(1);
  });

  it("reads not_uploaded for an empty version list", () => {
    expect(summarizeJobProofs([]).current.state).toBe("not_uploaded");
  });
});
