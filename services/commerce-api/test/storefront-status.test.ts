import { describe, expect, it } from "vitest";
import { JobRequestStatuses } from "@gwg/contracts";
import {
  hasPresentationForEveryStatus,
  jobStatusPresentation,
} from "../../../lib/commerce/status";

describe("customer job status presentation", () => {
  it("exposes every canonical status without enabling payment early", () => {
    expect(hasPresentationForEveryStatus()).toBe(true);

    for (const status of JobRequestStatuses) {
      expect(jobStatusPresentation[status].label).toBeTruthy();
      expect(jobStatusPresentation[status].nextAction).toBeTruthy();
      if (status !== "awaiting_payment" && status !== "payment_failed") {
        expect(jobStatusPresentation[status].paymentReady).toBe(false);
      }
    }
  });
});
