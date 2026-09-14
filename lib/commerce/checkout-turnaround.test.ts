import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FulfillmentSnapshotSchema } from "@gwg/contracts";

import {
  DELIVERY_OPTIONS,
  FREE_SHIPPING_BANNER,
  FREE_SHIPPING_THRESHOLD,
  RUSH_DATE_PROMPT,
  RUSH_DISCLAIMER,
  RUSH_TURNAROUND_LABEL,
  STANDARD_TURNAROUND_LABEL,
  STANDARD_TURNAROUND_NOTE,
  earliestRushDate,
  formatRequestedDate,
  shippingStateFor,
  toIsoDate,
} from "@/lib/schemas/checkout";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const delivery = stripComments(read("components/checkout/DeliveryStep.tsx"));
const turnaround = stripComments(read("components/checkout/TurnaroundStep.tsx"));
const summary = stripComments(read("components/checkout/CheckoutSummary.tsx"));
const wizard = stripComments(read("components/checkout/CheckoutWizard.tsx"));
const pills = stripComments(read("components/checkout/StepPills.tsx"));
const payment = stripComments(read("components/checkout/PaymentStep.tsx"));
const adminJob = stripComments(read("app/admin/jobs/[id]/page.tsx"));

const ADDRESS = {
  address1: "1 Test Street",
  city: "Vancouver",
  region: "BC",
  postalCode: "V6A 1A1",
  country: "Canada",
};

/**
 * CodSphere UAT V2 row 49 — Delivery Method. The section used to offer
 * "Standard Studio", "Priority Line" and "Rush 48-Hour" alongside pickup:
 * production speeds sold as shipping methods.
 */
describe("row 49 — delivery asks one question", () => {
  it("offers shipping or pickup, and nothing else", () => {
    expect(DELIVERY_OPTIONS.map((option) => option.key)).toEqual([
      "standard",
      "pickup",
    ]);
  });

  it("no longer names the three production speeds", () => {
    for (const gone of ["Standard Studio", "Priority Line", "Rush 48-Hour"]) {
      expect(delivery).not.toContain(gone);
    }
  });

  it("uses the client's own labels", () => {
    expect(DELIVERY_OPTIONS[0]!.name).toBe("Ship My Order");
    expect(DELIVERY_OPTIONS[1]!.name).toBe("Free Vancouver Pickup");
  });

  it("puts the threshold above the options, not inside one", () => {
    expect(FREE_SHIPPING_BANNER).toBe("FREE SHIPPING ON ORDERS $300+");
    expect(delivery).toContain('data-checkout="free-shipping-banner"');
  });

  it("is titled Delivery Method rather than Fulfilment", () => {
    expect(delivery).toContain("Delivery Method");
    expect(delivery).not.toMatch(/>\s*Fulfilment\s*</);
  });

  it("sends a legacy priority or rush cart to shipping, not to nothing", () => {
    // Those keys still exist on old carts in localStorage.
    expect(delivery).toMatch(/defaultValue === "pickup" \? "pickup" : "standard"/);
    expect(wizard).toMatch(/parsed\.delivery === "pickup" \? "pickup" : "standard"/);
  });
});

describe("row 49 — what the shipping line is allowed to say", () => {
  it("is free at and above the threshold", () => {
    const state = shippingStateFor("standard", FREE_SHIPPING_THRESHOLD);
    expect(state.kind).toBe("free");
    expect(state.label).toBe("FREE");
    expect(state.includedInTotal).toBe(true);
  });

  it("is to-be-confirmed below it — never $0, never Free", () => {
    const state = shippingStateFor("standard", 299.99);
    expect(state.kind).toBe("to-be-confirmed");
    expect(state.label).toBe("To be confirmed");
    expect(state.label).not.toMatch(/free/i);
    expect(state.label).not.toContain("0");
  });

  it("is free for pickup at any value", () => {
    expect(shippingStateFor("pickup", 10).label).toBe("FREE");
    expect(shippingStateFor("pickup", 10).includedInTotal).toBe(true);
  });

  it("keeps an unconfirmed shipping cost out of the estimated total", () => {
    // The client was explicit: do not add a figure we have not quoted.
    expect(shippingStateFor("standard", 100).includedInTotal).toBe(false);
    expect(summary).toContain('data-checkout="shipping-excluded-note"');
  });

  it("adds no delivery fee to the totals anywhere", () => {
    expect(summary).not.toContain("DELIVERY_FEES");
    expect(payment).not.toContain("DELIVERY_FEES");
    expect(summary).toContain("computeCartTotals(items)");
  });

  it("labels the total as the client asked", () => {
    expect(summary).toContain("Estimated Total");
  });

  it("replaces the technical payment notice with the client's wording", () => {
    expect(payment).toContain("No payment today");
    expect(payment).toMatch(/confirm all details before payment/);
    expect(payment).not.toMatch(/Preauthoriz/i);
  });
});

/**
 * CodSphere UAT V2 row 50 — Turnaround, "completely separate from
 * shipping/pickup", and never priced at checkout.
 */
describe("row 50 — turnaround is its own step", () => {
  it("sits between delivery and address", () => {
    expect(pills).toMatch(/"Delivery"[\s\S]{0,120}"Turnaround"[\s\S]{0,200}"Address"/);
  });

  it("is reached from delivery and leads to the address", () => {
    expect(delivery).toContain("Continue to Turnaround →");
    expect(wizard).toContain("Continue to Address →");
    expect(wizard).toContain("Continue to Pickup →");
  });

  it("offers exactly standard and rush, in the client's words", () => {
    expect(STANDARD_TURNAROUND_LABEL).toBe(
      "Standard Production — 5–7 Business Days",
    );
    expect(STANDARD_TURNAROUND_NOTE).toBe("No additional charge.");
    expect(RUSH_TURNAROUND_LABEL).toBe("Request Rush Production");
    // The component renders those constants rather than its own copies, so
    // the wording cannot drift between the two.
    expect(turnaround).toContain("STANDARD_TURNAROUND_LABEL");
    expect(turnaround).toContain("RUSH_TURNAROUND_LABEL");
  });

  it("asks for a date only once rush is chosen", () => {
    expect(RUSH_DATE_PROMPT).toBe("When do you need your order?");
    expect(turnaround).toContain("RUSH_DATE_PROMPT");
    expect(turnaround).toMatch(/option\.key === "rush" && kind === "rush"/);
  });

  it("carries the client's disclaimer word for word", () => {
    expect(RUSH_DISCLAIMER).toBe(
      "Rush availability and pricing depend on your order requirements and our current production schedule. A Great West Graphics customer service representative will contact you to confirm the requested date and any applicable rush charges. Selecting a date does not guarantee completion by that date.",
    );
    expect(turnaround).toContain("RUSH_DISCLAIMER");
  });

  it("never charges or calculates a rush fee", () => {
    // The word the client used was "To Be Confirmed" — there is no amount
    // anywhere in this flow to get wrong.
    expect(turnaround).not.toMatch(/rushFee|RUSH_FEE_AMOUNT|\* *1\.\d/);
    expect(summary).toContain('data-checkout="rush-fee-row"');
    expect(summary).toContain("RUSH_FEE_LABEL");
  });

  it("shows the request and the unset fee in the order summary", () => {
    expect(summary).toContain("Rush Requested — ");
    expect(summary).toContain('data-checkout="turnaround-row"');
  });
});

describe("row 50 — the rush request survives to the people who act on it", () => {
  it("is submitted on the order rather than buried in a note", () => {
    expect(wizard).toContain("turnaround: data.turnaround");
  });

  it("is flagged for staff at the top of the job page", () => {
    expect(adminJob).toContain('data-admin="rush-request"');
    expect(adminJob).toContain("RUSH_FLAG_LABEL");
    expect(adminJob).toContain("formatRequestedDate");
  });
});

describe("the turnaround contract", () => {
  it("accepts a rush request carrying its date", () => {
    const parsed = FulfillmentSnapshotSchema.safeParse({
      method: "standard",
      address: ADDRESS,
      turnaround: { kind: "rush", requestedDate: "2026-09-22" },
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a rush with no date", () => {
    const parsed = FulfillmentSnapshotSchema.safeParse({
      method: "standard",
      address: ADDRESS,
      turnaround: { kind: "rush" },
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses a date that is not an ISO day", () => {
    const parsed = FulfillmentSnapshotSchema.safeParse({
      method: "standard",
      address: ADDRESS,
      turnaround: { kind: "rush", requestedDate: "22/09/2026" },
    });
    expect(parsed.success).toBe(false);
  });

  it("still accepts an order placed before row 50 existed", () => {
    // No turnaround at all: nothing stored needs migrating.
    const parsed = FulfillmentSnapshotSchema.safeParse({
      method: "pickup",
    });
    expect(parsed.success).toBe(true);
  });

  it("still accepts the legacy priority and rush delivery methods", () => {
    for (const method of ["priority", "rush"]) {
      expect(
        FulfillmentSnapshotSchema.safeParse({ method, address: ADDRESS })
          .success,
      ).toBe(true);
    }
  });
});

describe("the requested date is handled in the customer's own timezone", () => {
  it("renders the day that was picked, not the day before", () => {
    // `new Date("2026-09-22")` is UTC midnight, which is 21 September in
    // Vancouver. Building from the parts avoids that entirely.
    expect(formatRequestedDate("2026-09-22")).toContain("22");
    expect(formatRequestedDate("2026-09-22")).toContain("2026");
  });

  it("returns anything unparseable untouched rather than inventing a date", () => {
    expect(formatRequestedDate("not-a-date")).toBe("not-a-date");
  });

  it("will not accept today or a past date", () => {
    const today = new Date(2026, 8, 14);
    expect(earliestRushDate(today)).toBe("2026-09-15");
  });

  it("rolls over month ends correctly", () => {
    expect(earliestRushDate(new Date(2026, 8, 30))).toBe("2026-10-01");
    expect(toIsoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
