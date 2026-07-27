import { describe, expect, it } from "vitest";
import { JobRequestStatuses } from "@gwg/contracts";
import {
  assertJobRequestTransition,
  InvalidJobRequestTransitionError,
  validNextStatuses,
} from "../src/domain/job-request-state.js";

describe("job request state machine", () => {
  it("allows the approval-first happy path", () => {
    const path = [
      "draft",
      "submitted",
      "under_review",
      "approved",
      "awaiting_payment",
      "payment_pending",
      "paid",
      "ready_for_production",
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
});
