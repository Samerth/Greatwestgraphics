import { describe, expect, it } from "vitest";
import { JobRequestStatuses } from "@gwg/contracts";
import {
  JOB_PIPELINE_STAGES,
  everyStatusHasAPipelineOutcome,
  jobPipelineState,
  staffNextStatuses,
} from "@/lib/admin/job-pipeline";

describe("jobPipelineState", () => {
  it("maps every real status onto a stage or the off-track branch", () => {
    expect(everyStatusHasAPipelineOutcome()).toBe(true);
  });

  it.each(JobRequestStatuses)("%s produces a usable state", (status) => {
    const result = jobPipelineState({
      status,
      awaitingCustomerProof: false,
      proofApproved: false,
    });
    if (status === "cancelled" || status === "rejected") {
      expect(result.offTrack).not.toBeNull();
      expect(result.stages).toHaveLength(0);
    } else {
      expect(result.offTrack).toBeNull();
      expect(result.stages).toHaveLength(JOB_PIPELINE_STAGES.length);
      expect(result.stages.filter((s) => s.state === "current")).toHaveLength(1);
    }
  });

  it("treats a proof awaiting the customer as the current stage, regardless of status", () => {
    const result = jobPipelineState({
      status: "under_review",
      awaitingCustomerProof: true,
      proofApproved: false,
    });
    const current = result.stages.find((s) => s.state === "current");
    expect(current?.label).toBe("Awaiting Proof Approval");
  });

  it("marks Awaiting Proof Approval as done once the job has moved past it", () => {
    const result = jobPipelineState({
      status: "in_production",
      awaitingCustomerProof: false,
      proofApproved: true,
    });
    const proofStage = result.stages.find((s) => s.label === "Awaiting Proof Approval");
    expect(proofStage?.state).toBe("done");
  });

  it("shows a draft job as not yet submitted, still on the first stage", () => {
    const result = jobPipelineState({
      status: "draft",
      awaitingCustomerProof: false,
      proofApproved: false,
    });
    expect(result.stages[0]?.label).toBe("Submitted");
    expect(result.stages[0]?.state).toBe("current");
    expect(result.stages[0]?.detail).toBe("not yet submitted");
  });
});

describe("staffNextStatuses", () => {
  // This filtering previously lived inline in the admin job page with zero
  // test coverage of its own.
  it("removes 'shipped' as an option for a pickup order", () => {
    const next = staffNextStatuses("in_production", "pickup");
    expect(next).not.toContain("shipped");
    expect(next).toContain("ready_for_pickup");
  });

  it("removes 'ready_for_pickup' as an option for a shipping order", () => {
    const next = staffNextStatuses("in_production", "standard");
    expect(next).not.toContain("ready_for_pickup");
    expect(next).toContain("shipped");
  });

  it("offers both when the fulfilment method is unknown", () => {
    const next = staffNextStatuses("in_production", undefined);
    expect(next).toContain("shipped");
    expect(next).toContain("ready_for_pickup");
  });

  it("is unaffected outside in_production", () => {
    expect(staffNextStatuses("submitted", "pickup")).toEqual(
      staffNextStatuses("submitted", "standard"),
    );
  });
});
