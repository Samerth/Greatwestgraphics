import { describe, expect, it } from "vitest";
import type { JobRequestDetailResponse } from "@gwg/contracts";
import { buildJobView, safeProofUrl } from "@/lib/admin/job-view";

const V2_SNAPSHOT = {
  schemaVersion: 2 as const,
  input: {
    garments: [{ id: "g1" }],
    decorations: [
      { id: "d1", garmentId: "g1", methodKey: "screenPrint", location: "front", colours: 1, logoGroup: "", isOversized: false, artwork: { isRepeat: false, verifiedByStaff: false } },
    ],
    options: { rush: false, includePacking: false, namesNumbers: false, shippingCostMinor: 0, designHours: 0 },
  },
  // A single 24-piece line's own snapshot — its totalMinor must equal that
  // one line's lineTotalMinor below, since there's nothing else sharing it.
  breakdown: {
    totals: {
      merchandiseMinor: 32000,
      decorationMinor: 14000,
      setupMinor: 3500,
      threadMinor: 0,
      namesNumbersMinor: 0,
      packingMinor: 564,
      rushMinor: 0,
      subtotalBeforeRushMinor: 50064,
      totalMinor: 50064,
    },
  },
  pricingConfigVersion: 4,
};

function line(options: { id?: string; configuration?: Record<string, unknown> } = {}) {
  return {
    id: options.id ?? "line-1",
    position: 0,
    snapshot: {
      productId: "prod-1",
      description: "Allmade Unisex Organic Cotton Tee",
      quantity: 24,
      unitPriceEstimateMinor: 2086,
      lineTotalMinor: 50064,
      currency: "CAD",
      configuration: {
        color: "Matcha Green",
        size: "XL",
        storefrontProductId: "prod-1:variant-xl",
        artworkProofUrl: "https://cdn.example.com/proof.png",
        pricing: V2_SNAPSHOT,
        ...options.configuration,
      },
    },
  };
}

function detail(overrides: Record<string, unknown> = {}): JobRequestDetailResponse {
  return {
    id: "job-1",
    displayId: "GWG-1034",
    context: { tenantId: "t1", accountId: "a1", storeId: "s1" },
    customerPersonId: "person-1",
    status: "submitted",
    version: 1,
    submittedAt: "2026-09-22T00:00:00Z",
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-22T00:00:00Z",
    customerNote: "Please rush if possible",
    contact: { email: "kartik@example.com", fullName: "Kartik Sharma", phone: "6045551234", company: "GWG" },
    fulfillment: {
      method: "pickup",
      turnaround: { kind: "standard" },
    },
    inventory: { lines: [{ lineId: "line-1", description: "Allmade Unisex Organic Cotton Tee", requested: 24, available: 418, sku: "39816-5" }] },
    lines: [line()],
    timeline: [],
    finalQuotes: [],
    proofs: [],
    internalNote: null,
    internalNoteUpdatedAt: null,
    internalNoteUpdatedBy: null,
    rushConfirmedAt: null,
    promisedDate: null,
    rushConfirmedBy: null,
    invoiceRequestedAt: null,
    ...overrides,
  } as unknown as JobRequestDetailResponse;
}

describe("buildJobView", () => {
  it("maps the header and summary from the response", () => {
    const view = buildJobView(detail(), "Main store");
    expect(view.header.displayId).toBe("GWG-1034");
    expect(view.header.customerName).toBe("Kartik Sharma");
    expect(view.summary.quantity).toBe(24);
    expect(view.summary.totalMinor).toBe(50064);
    expect(view.summary.method).toBe("pickup");
    expect(view.summary.isRush).toBe(false);
  });

  it("builds one product per colour, with its own size breakdown and stock", () => {
    const view = buildJobView(detail(), "Main store");
    expect(view.products).toHaveLength(1);
    const product = view.products[0]!;
    expect(product.color).toBe("Matcha Green");
    expect(product.sizeBreakdown).toBe("XL 24");
    expect(product.stock?.state).toBe("ok");
    expect(product.decorations[0]?.location).toBe("Front");
  });

  it("folds the money breakdown correctly for a single-snapshot order", () => {
    const view = buildJobView(detail(), "Main store");
    expect(view.money.snapshotCount).toBe(1);
    expect(view.money.reconciles).toBe(true);
    expect(view.money.orderTotalMinor).toBe(50064);
  });

  it("reads the not-yet-uploaded proof state when there are no proofs", () => {
    const view = buildJobView(detail(), "Main store");
    expect(view.proofs.current.state).toBe("not_uploaded");
  });

  it("marks the Awaiting Proof Approval stage current while a proof is out to the customer", () => {
    const withProof = detail({
      proofs: [
        {
          id: "proof-1",
          jobRequestId: "job-1",
          version: 1,
          storageKey: "https://cdn.example.com/proof-v1.png",
          decision: "pending",
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
          awaitingDecisionFrom: "customer",
          note: null,
          createdBy: null,
          createdAt: "2026-09-21T00:00:00Z",
        },
      ],
    });
    const view = buildJobView(withProof, "Main store");
    expect(view.proofs.current.state).toBe("sent");
    const current = view.pipeline.stages.find((s) => s.state === "current");
    expect(current?.label).toBe("Awaiting Proof Approval");
  });

  it("collects the internal note and its author, unredacted, for a staff view", () => {
    const withNote = detail({
      internalNote: "Customer called about a wrong colour",
      internalNoteUpdatedAt: "2026-09-22T00:00:00Z",
      internalNoteUpdatedBy: { type: "staff", displayName: "Pavin" },
    });
    const view = buildJobView(withNote, "Main store");
    expect(view.notes.internal).toBe("Customer called about a wrong colour");
    expect(view.notes.internalUpdatedByName).toBe("Pavin");
  });

  it("builds a flat files list covering the proof and the mockup", () => {
    const withProof = detail({
      proofs: [
        {
          id: "proof-1",
          jobRequestId: "job-1",
          version: 1,
          storageKey: "https://cdn.example.com/proof-v1.png",
          decision: null,
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
          awaitingDecisionFrom: "customer",
          note: null,
          createdBy: null,
          createdAt: "2026-09-21T00:00:00Z",
        },
      ],
    });
    const view = buildJobView(withProof, "Main store");
    expect(view.files.some((f) => f.href === "https://cdn.example.com/proof.png")).toBe(true);
    expect(view.files.some((f) => f.href === "https://cdn.example.com/proof-v1.png")).toBe(true);
  });

  it("handles a legacy job with no contact, fulfilment, or pricing snapshot", () => {
    const legacy = detail({
      contact: null,
      fulfillment: null,
      lines: [
        line({
          id: "legacy-line",
          configuration: { color: "Black", size: "M", pricing: undefined, artworkProofUrl: undefined },
        }),
      ],
    });
    expect(() => buildJobView(legacy, "Main store")).not.toThrow();
    const view = buildJobView(legacy, "Main store");
    expect(view.header.customerName).toBeNull();
    expect(view.summary.method).toBe("unknown");
  });
});

describe("safeProofUrl", () => {
  it("accepts a root-relative path", () => {
    expect(safeProofUrl("/api/uploads/proof.png")).toBe("/api/uploads/proof.png");
  });

  it("accepts an https URL", () => {
    expect(safeProofUrl("https://cdn.example.com/proof.png")).toBe(
      "https://cdn.example.com/proof.png",
    );
  });

  it("rejects a non-http(s) scheme", () => {
    expect(safeProofUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects garbage that isn't a URL or a path", () => {
    expect(safeProofUrl("not a url")).toBeNull();
  });
});
