import { describe, expect, it } from "vitest";
import { isStaffOpenJob, JobRequestStatuses } from "@gwg/contracts";
import {
  assertJobRequestTransition,
  InvalidJobRequestTransitionError,
  validNextStatuses,
} from "../src/domain/job-request-state.js";

describe("job request state machine", () => {
  it("allows the approval-first happy path through fulfillment", () => {
    const path = [
      "draft",
      "submitted",
      "under_review",
      "approved",
      "awaiting_payment",
      "payment_pending",
      "paid",
      "ready_for_production",
      "in_production",
      "shipped",
      "completed",
    ] as const;

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(() =>
        assertJobRequestTransition(path[index]!, path[index + 1]!),
      ).not.toThrow();
    }
  });

  it("supports proof changes and resubmission", () => {
    expect(validNextStatuses("under_review")).toContain("changes_requested");
    expect(() =>
      assertJobRequestTransition("changes_requested", "submitted"),
    ).not.toThrow();
  });

  it("never releases production before payment", () => {
    for (const status of JobRequestStatuses) {
      if (status !== "paid") {
        expect(() =>
          assertJobRequestTransition(status, "ready_for_production"),
        ).toThrow(InvalidJobRequestTransitionError);
      }
    }
  });

  it("rejects skipped approval and payment states", () => {
    expect(() => assertJobRequestTransition("submitted", "paid")).toThrow(
      InvalidJobRequestTransitionError,
    );
    expect(() =>
      assertJobRequestTransition("approved", "ready_for_production"),
    ).toThrow(InvalidJobRequestTransitionError);
  });

  it("lets staff record offline payment without visiting payment_pending", () => {
    expect(() =>
      assertJobRequestTransition("awaiting_payment", "paid"),
    ).not.toThrow();
  });

  it("counts live staff work as open and hides drafts and terminals", () => {
    expect(isStaffOpenJob("submitted")).toBe(true);
    expect(isStaffOpenJob("awaiting_payment")).toBe(true);
    expect(isStaffOpenJob("in_production")).toBe(true);
    expect(isStaffOpenJob("draft")).toBe(false);
    expect(isStaffOpenJob("completed")).toBe(false);
    expect(isStaffOpenJob("cancelled")).toBe(false);
    expect(isStaffOpenJob("rejected")).toBe(false);
  });

  it("allows pickup completion and cancellation from live jobs", () => {
    expect(() =>
      assertJobRequestTransition("in_production", "ready_for_pickup"),
    ).not.toThrow();
    expect(() =>
      assertJobRequestTransition("ready_for_pickup", "completed"),
    ).not.toThrow();
    expect(() =>
      assertJobRequestTransition("paid", "cancelled"),
    ).not.toThrow();
    expect(validNextStatuses("completed")).toEqual([]);
    expect(validNextStatuses("cancelled")).toEqual([]);
  });
});
