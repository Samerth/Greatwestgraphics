import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { JobRequestStatuses, type JobRequestStatus } from "@gwg/contracts";

import {
  PORTAL_STAGES,
  PROOF_APPROVAL_WARNING,
  formatPortalDate,
  formatPortalDateTime,
  portalDecorations,
  portalNextAction,
  portalStageIndex,
  portalStageStates,
  portalTimeline,
} from "./portal-progress";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = stripComments(read("app/portal/jobs/[id]/page.tsx"));
const proof = stripComments(read("components/portal/ProofReview.tsx"));
const progress = stripComments(read("components/portal/PortalProgress.tsx"));
const items = stripComments(read("components/portal/PortalSubmittedItems.tsx"));
const quote = stripComments(read("components/portal/FinalQuoteReview.tsx"));

const BASE = {
  status: "under_review" as JobRequestStatus,
  awaitingProofDecision: false,
  hasUnacceptedQuote: false,
  quoteAccepted: false,
  alreadyPaid: false,
  invoiceRequested: false,
};

/** CodSphere UAT V2 row 55, point 1 — the stage tracker. */
describe("the five stages the client asked for", () => {
  it("uses their wording, in their order", () => {
    expect([...PORTAL_STAGES]).toEqual([
      "Order Submitted",
      "Artwork Review",
      "Proof Approval",
      "Production",
      "Ready / Shipped",
    ]);
  });

  it("places every status the system can reach", () => {
    // A status with no home would render a tracker with nothing lit.
    for (const status of JobRequestStatuses) {
      const index = portalStageIndex(status);
      expect(
        index === -1 || (index >= 0 && index < PORTAL_STAGES.length),
        `${status} has no stage`,
      ).toBe(true);
    }
  });

  it("moves forward, never backward, as an order progresses", () => {
    const journey: JobRequestStatus[] = [
      "submitted",
      "under_review",
      "approved",
      "paid",
      "in_production",
      "shipped",
    ];
    const indexes = journey.map(portalStageIndex);
    for (let i = 1; i < indexes.length; i++) {
      expect(indexes[i]!).toBeGreaterThanOrEqual(indexes[i - 1]!);
    }
  });

  it("marks earlier stages done and later ones upcoming", () => {
    const states = portalStageStates("in_production");
    expect(states.map((entry) => entry.state)).toEqual([
      "done",
      "done",
      "done",
      "current",
      "upcoming",
    ]);
  });

  it("lights nothing for a cancelled or rejected job", () => {
    // A tracker stuck at stage one tells the wrong story entirely.
    for (const status of ["cancelled", "rejected"] as JobRequestStatus[]) {
      expect(
        portalStageStates(status).every((entry) => entry.state === "upcoming"),
      ).toBe(true);
    }
  });

  it("is hidden rather than rendered empty in that case", () => {
    expect(progress).toContain("offTrack");
    expect(progress).toContain('data-portal="stage-tracker"');
  });
});

/** Point 2 — whether the customer or GWG is holding the order up. */
describe("the next action says who is being waited on", () => {
  it("puts a waiting proof above everything else", () => {
    // A job can read "Submitted" and still have a proof in front of the
    // customer, which is exactly the case the status label gets wrong.
    const action = portalNextAction({
      ...BASE,
      status: "submitted",
      awaitingProofDecision: true,
    });
    expect(action.required).toBe(true);
    expect(action.title).toMatch(/review your proof/i);
  });

  it("asks for a reply when changes were requested", () => {
    const action = portalNextAction({ ...BASE, status: "changes_requested" });
    expect(action.required).toBe(true);
  });

  it("asks the customer to accept a posted quote", () => {
    const action = portalNextAction({
      ...BASE,
      status: "approved",
      hasUnacceptedQuote: true,
    });
    expect(action.required).toBe(true);
    expect(action.title).toMatch(/quote/i);
  });

  it("stops asking once the quote is accepted and paid", () => {
    const action = portalNextAction({
      ...BASE,
      status: "paid",
      hasUnacceptedQuote: true,
      quoteAccepted: true,
      alreadyPaid: true,
    });
    expect(action.required).toBe(false);
  });

  it("stops asking for payment once an invoice has been requested", () => {
    const action = portalNextAction({
      ...BASE,
      status: "awaiting_payment",
      hasUnacceptedQuote: true,
      quoteAccepted: true,
      invoiceRequested: true,
    });
    expect(action.required).toBe(false);
  });

  it("names what GWG is doing when nothing is outstanding", () => {
    const action = portalNextAction({ ...BASE, status: "in_production" });
    expect(action.required).toBe(false);
    expect(action.title).toBe("No action required");
    expect(action.body).toMatch(/printed/i);
  });

  it("gives every status a sentence rather than a fallback", () => {
    for (const status of JobRequestStatuses) {
      const action = portalNextAction({ ...BASE, status });
      expect(action.body.length).toBeGreaterThan(10);
      expect(action.body).not.toBe("Our team is working on your order.");
    }
  });

  it("is rendered with the client's ACTION REQUIRED wording", () => {
    expect(progress).toContain("ACTION REQUIRED");
    expect(progress).toContain('data-portal="next-action"');
  });
});

/** Point 8 — the timeline in the customer's language. */
describe("the timeline", () => {
  const history = [
    { toStatus: "submitted" as JobRequestStatus, occurredAt: "2026-09-09T10:00:00.000Z" },
    { toStatus: "under_review" as JobRequestStatus, occurredAt: "2026-09-09T15:00:00.000Z" },
  ];

  it("reports one row per stage, not per status change", () => {
    expect(portalTimeline("under_review", history)).toHaveLength(5);
  });

  it("dates the stages that have been reached", () => {
    const entries = portalTimeline("under_review", history);
    expect(entries[0]!.occurredAt).toBe("2026-09-09T10:00:00.000Z");
    expect(entries[1]!.occurredAt).toBe("2026-09-09T15:00:00.000Z");
    expect(entries[2]!.occurredAt).toBeNull();
  });

  it("takes the first time a stage was reached, not the last", () => {
    // A job bounced back to review must still show when review first began.
    const bounced = [
      ...history,
      { toStatus: "changes_requested" as JobRequestStatus, occurredAt: "2026-09-11T09:00:00.000Z" },
    ];
    expect(portalTimeline("changes_requested", bounced)[1]!.occurredAt).toBe(
      "2026-09-09T15:00:00.000Z",
    );
  });

  it("is not confused by history arriving out of order", () => {
    const shuffled = [...history].reverse();
    expect(portalTimeline("under_review", shuffled)[0]!.occurredAt).toBe(
      "2026-09-09T10:00:00.000Z",
    );
  });

  it("renders the tick, dot and circle markers", () => {
    expect(progress).toContain('data-portal="timeline"');
    expect(progress).toMatch(/"✓"[\s\S]*"●"[\s\S]*"○"/);
  });
});

/** Points 4 and 5 — the proof. */
describe("the proof is the focal point", () => {
  it("leads the page rather than sitting under the order summary", () => {
    expect(page.indexOf("ProofReview")).toBeLessThan(
      page.indexOf("PortalSubmittedItems"),
    );
  });

  it("gives the preview the content width", () => {
    expect(proof).toMatch(/className="w-full max-h-\[32rem\]/);
    expect(proof).toContain("View Full Proof");
  });

  it("labels the version and upload date the way the client wrote it", () => {
    expect(proof).toMatch(/Proof V\{proof\.version\}/);
    expect(proof).toContain("Uploaded ");
  });

  it("uses the client's button labels", () => {
    expect(proof).toContain("APPROVE PROOF");
    expect(proof).toContain("SUBMIT REVISION REQUEST");
  });

  it("shows the authorisation warning beside the approve control", () => {
    expect(PROOF_APPROVAL_WARNING).toContain("authorize GWG to proceed");
    expect(proof).toContain("PROOF_APPROVAL_WARNING");
    expect(proof).toContain('data-portal="approval-warning"');
  });

  it("asks for a comment only when changes are being requested", () => {
    expect(proof).toMatch(/decision === "changes_requested" && \(/);
  });

  it("closes the action out once approved", () => {
    expect(proof).toContain('data-portal="proof-approved"');
    expect(proof).toContain("✓ PROOF APPROVED");
    expect(proof).toContain("released for production");
  });

  it("keeps an approved proof viewable", () => {
    // "The customer should still be able to view the approved proof."
    expect(proof).toMatch(/ApprovedProof[\s\S]{0,900}?<ProofAsset/);
  });
});

/** Point 3 — submitted items. */
describe("submitted items", () => {
  it("folds the one-line-per-size storage into one row per product", () => {
    expect(items).toContain("groupAdminJobLines");
    expect(items).toContain("formatSizeBreakdown");
    expect(items).toContain('data-portal="size-breakdown"');
  });

  it("shows the product image and the decoration", () => {
    expect(items).toContain("portalDecorations");
    expect(items).toMatch(/Decoration/);
  });
});

describe("decoration is read defensively out of the pricing snapshot", () => {
  it("names the method and location in plain language", () => {
    expect(
      portalDecorations({
        input: {
          decorations: [
            { methodKey: "screen", location: "front", colours: 2 },
          ],
        },
      }),
    ).toEqual([
      { method: "Screen Print", location: "Front", detail: "2 colours" },
    ]);
  });

  it("says one colour rather than 1 colours", () => {
    const [line] = portalDecorations({
      input: { decorations: [{ methodKey: "embroidery", location: "left", colours: 1 }] },
    });
    expect(line!.detail).toBe("1 colour");
    expect(line!.location).toBe("Left Sleeve");
  });

  it("does not list the same method and location twice", () => {
    expect(
      portalDecorations({
        input: {
          decorations: [
            { methodKey: "screen", location: "front", colours: 2 },
            { methodKey: "screen", location: "front", colours: 2 },
          ],
        },
      }),
    ).toHaveLength(1);
  });

  it("returns nothing at all for an order with no snapshot", () => {
    // Older lines carry none; a missing snapshot must not break the row.
    for (const input of [undefined, null, {}, { input: {} }, { input: { decorations: "x" } }]) {
      expect(portalDecorations(input)).toEqual([]);
    }
  });

  it("skips a malformed decoration rather than rendering undefined", () => {
    expect(
      portalDecorations({
        input: { decorations: [{ methodKey: 7, location: "front" }, null] },
      }),
    ).toEqual([]);
  });
});

/** Point 6 — the final quote area. */
describe("final pricing before it is issued", () => {
  it("reads as work in progress, not as an absence", () => {
    expect(quote).toContain("Final Pricing Under Review");
    expect(quote).toMatch(/reviewing your artwork, quantities and availability/);
    expect(quote).not.toContain("No final quote yet");
  });
});

describe("dates are formatted for a person", () => {
  it("renders a date and a date-with-time", () => {
    const iso = "2026-09-09T21:45:00.000Z";
    expect(formatPortalDate(iso)).toMatch(/2026/);
    expect(formatPortalDateTime(iso)).toContain(" at ");
  });

  it("returns empty rather than Invalid Date", () => {
    expect(formatPortalDate("nonsense")).toBe("");
    expect(formatPortalDateTime("nonsense")).toBe("");
  });
});
