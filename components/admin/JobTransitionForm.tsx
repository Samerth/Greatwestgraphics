"use client";

import { useState, useTransition } from "react";
import { transitionJobAction } from "@/app/admin/actions";
import { jobStatusPresentation } from "@/lib/commerce/status";
import type { JobRequestStatus } from "@gwg/contracts";

// The only transitions that actually produce a customer email today (see
// notificationsForEvent in services/commerce-api/src/notifications/messages.ts).
// Showing the checkbox on every other transition would offer a toggle that
// does nothing, which is worse than not offering it at all.
const NOTIFIABLE_STATUSES = new Set<string>([
  "ready_for_production",
  "in_production",
  "ready_for_pickup",
  "shipped",
  "completed",
  "rejected",
  "cancelled",
]);

export function JobTransitionForm({
  jobId,
  nextStatuses,
  compact = false,
}: {
  jobId: string;
  nextStatuses: readonly JobRequestStatus[];
  compact?: boolean;
}) {
  const [toStatus, setToStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showNotifyToggle = NOTIFIABLE_STATUSES.has(toStatus);
  const cancelling = toStatus === "cancelled";

  return (
    <form
      action={(formData: FormData) => {
        startTransition(async () => {
          const result = await transitionJobAction(
            jobId,
            String(formData.get("toStatus") || ""),
            String(formData.get("reason") || "") || undefined,
            showNotifyToggle ? formData.get("notify") === "on" : true,
          );
          setError(result.error ?? null);
        });
      }}
      className={
        compact
          ? "flex flex-wrap gap-2 items-center"
          : "flex flex-wrap gap-2 items-end border border-border rounded-md p-sp-3 bg-bg-raised"
      }
    >
      <label className={compact ? "text-sm" : "text-sm font-semibold"}>
        {!compact && <span className="block">Transition</span>}
        <select
          name="toStatus"
          value={toStatus}
          onChange={(e) => setToStatus(e.target.value)}
          className={
            compact
              ? "border border-border rounded-sm px-2 py-1 text-sm"
              : "block mt-1 border border-border rounded-sm px-2 py-1"
          }
          required
        >
          <option value="" disabled>
            {compact ? "Transition to…" : "Select status"}
          </option>
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {jobStatusPresentation[status].label}
            </option>
          ))}
        </select>
      </label>
      <label className={compact ? "text-sm" : "text-sm font-semibold"}>
        {!compact && (
          <span className="block">Reason{cancelling ? " (required)" : ""}</span>
        )}
        <input
          name="reason"
          required={cancelling}
          placeholder={compact ? "Reason (required to cancel)" : "Required to cancel"}
          className={
            compact
              ? "border border-border rounded-sm px-2 py-1 text-sm"
              : "block mt-1 border border-border rounded-sm px-2 py-1"
          }
        />
      </label>
      {showNotifyToggle && (
        <label
          className={
            compact
              ? "flex items-center gap-1.5 text-xs"
              : "flex items-center gap-2 text-sm font-semibold pb-2"
          }
        >
          <input type="checkbox" name="notify" defaultChecked />
          Email the customer
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "bg-accent text-white text-sm font-bold px-3 py-1 rounded-sm disabled:opacity-60"
            : "bg-accent text-white font-bold px-4 py-2 rounded-sm disabled:opacity-60"
        }
      >
        {pending ? "Applying…" : "Apply"}
      </button>
      {error && (
        <p
          role="alert"
          className={
            compact
              ? "w-full text-xs text-red-800 m-0"
              : "text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0"
          }
        >
          {error}
        </p>
      )}
    </form>
  );
}