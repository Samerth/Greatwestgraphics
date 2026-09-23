import { describe, expect, it } from "vitest";
import { JobRequestStatuses } from "@gwg/contracts";
import {
  hasPresentationForEveryStatus,
  jobStatusPresentation,
  type StatusTone,
} from "@/lib/commerce/status";

const VALID_TONES: readonly StatusTone[] = [
  "neutral",
  "info",
  "progress",
  "success",
  "warning",
  "danger",
];

describe("jobStatusPresentation", () => {
  it("has an entry for every status", () => {
    expect(hasPresentationForEveryStatus()).toBe(true);
  });

  it.each(JobRequestStatuses)("%s has a real tone", (status) => {
    expect(VALID_TONES).toContain(jobStatusPresentation[status].tone);
  });

  // Two statuses a staff member should never mistake for "fine" — a wrong
  // tone here would read backwards on the job page and the staff inbox.
  it("marks failure states as danger, not something calmer", () => {
    expect(jobStatusPresentation.payment_failed.tone).toBe("danger");
    expect(jobStatusPresentation.rejected.tone).toBe("danger");
    expect(jobStatusPresentation.cancelled.tone).toBe("danger");
  });

  it("marks completed work as success", () => {
    expect(jobStatusPresentation.completed.tone).toBe("success");
    expect(jobStatusPresentation.paid.tone).toBe("success");
  });
});
