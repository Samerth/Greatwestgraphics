"use client";

import { useState, useTransition } from "react";
import type { JobRequestStatus } from "@gwg/contracts";
import { transitionJobAction } from "@/app/admin/actions";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { ProgressTrack, type TrackStage } from "@/components/ui/ProgressTrack";
import { Badge } from "@/components/ui/Badge";

const NOTIFIABLE_STATUSES = new Set<string>([
  "ready_for_production",
  "in_production",
  "ready_for_pickup",
  "shipped",
  "completed",
  "rejected",
  "cancelled",
]);

/**
 * Replaces `JobTransitionForm` on the job detail page (the compact variant
 * stays in use on the jobs list). Two things the client asked for
 * specifically (11-point admin note, point 2): a clearly labelled control
 * instead of "Transition / Reason / Apply," and Cancel available but not
 * one dropdown option away from "Ready for pickup" — so it's a separate,
 * quietly-styled control of its own rather than another entry in the same
 * select.
 */
export function JobStatusControl({
  jobId,
  statusLabel,
  tone,
  pipeline,
  offTrack,
  nextStatuses,
}: {
  jobId: string;
  statusLabel: string;
  tone: Parameters<typeof Badge>[0]["tone"];
  pipeline: TrackStage[];
  offTrack: { label: string; tone: Parameters<typeof Badge>[0]["tone"] } | null;
  nextStatuses: readonly JobRequestStatus[];
}) {
  const movableStatuses = nextStatuses.filter((s) => s !== "cancelled");
  const canCancel = nextStatuses.includes("cancelled");

  const [toStatus, setToStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showNotifyToggle = NOTIFIABLE_STATUSES.has(toStatus);

  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, startCancelTransition] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  return (
    <div className="space-y-sp-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-text-secondary">Order status</span>
        <Badge tone={tone}>{statusLabel}</Badge>
      </div>

      {offTrack ? (
        <Badge tone={offTrack.tone}>{offTrack.label}</Badge>
      ) : (
        <ProgressTrack stages={pipeline} />
      )}

      {movableStatuses.length > 0 ? (
        <form
          action={(formData: FormData) => {
            startTransition(async () => {
              const result = await transitionJobAction(
                jobId,
                String(formData.get("toStatus") || ""),
                undefined,
                showNotifyToggle ? formData.get("notify") === "on" : true,
              );
              setError(result.error ?? null);
            });
          }}
          className="flex flex-wrap items-end gap-2 pt-1"
        >
          <label className="text-sm font-semibold">
            Move order to
            <select
              name="toStatus"
              value={toStatus}
              onChange={(e) => setToStatus(e.target.value)}
              required
              className="block mt-1 border border-border rounded-sm px-2 py-1.5"
            >
              <option value="" disabled>
                Select a status…
              </option>
              {movableStatuses.map((status) => (
                <option key={status} value={status}>
                  {jobStatusPresentation[status].label}
                </option>
              ))}
            </select>
          </label>
          {showNotifyToggle && (
            <label className="flex items-center gap-2 text-sm font-semibold pb-2">
              <input type="checkbox" name="notify" defaultChecked />
              Email the customer
            </label>
          )}
          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-white font-bold px-4 py-2 rounded-sm disabled:opacity-60"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
          {error && (
            <p role="alert" className="w-full text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-text-secondary m-0">
          This job is in a terminal status. No further staff transitions are available.
        </p>
      )}

      {canCancel && (
        <div className="border-t border-border pt-3">
          {!confirmingCancel ? (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="text-sm font-bold text-text-tertiary hover:text-red-700"
            >
              Cancel this job
            </button>
          ) : (
            <form
              action={(formData: FormData) => {
                startCancelTransition(async () => {
                  const result = await transitionJobAction(
                    jobId,
                    "cancelled",
                    String(formData.get("reason") || ""),
                    true,
                  );
                  setCancelError(result.error ?? null);
                  if (!result.error) setConfirmingCancel(false);
                });
              }}
              className="space-y-2"
            >
              <label className="block text-sm font-semibold text-red-800">
                Reason (required)
                <input
                  name="reason"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why is this job being cancelled?"
                  className="block mt-1 w-full border border-red-300 rounded-sm px-2 py-1.5"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={cancelling}
                  className="bg-red-700 text-white font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-60"
                >
                  {cancelling ? "Cancelling…" : "Cancel this job"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="text-sm font-bold text-text-tertiary"
                >
                  Never mind
                </button>
              </div>
              {cancelError && (
                <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0">
                  {cancelError}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
