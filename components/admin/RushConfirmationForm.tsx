"use client";

import { useActionState } from "react";
import {
  confirmRushRequestAction,
  type RushConfirmationState,
} from "@/app/admin/actions";
import { formatPortalDateTime, formatPortalDate } from "@/lib/commerce/portal-progress";

const initialState: RushConfirmationState = {};

/**
 * The client's own point 3: the requested date needs to be unmissable, and
 * "once confirmed, staff should be able to mark the rush request as
 * confirmed." The date staff actually promise (`promisedDate`) is kept
 * separate from what the customer originally asked for (`requestedDate`) —
 * real shops negotiate, and the promise on record should be the one a
 * person actually typed, not a silent copy of the request.
 */
export function RushConfirmationForm({
  jobId,
  requestedDate,
  promisedDate,
  confirmedAt,
  confirmedByName,
}: {
  jobId: string;
  requestedDate: string | null;
  promisedDate: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
}) {
  const [state, formAction, pending] = useActionState(confirmRushRequestAction, initialState);

  if (confirmedAt) {
    return (
      <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="confirmed" value="false" />
        <span className="text-sm font-bold text-green-800">
          ✓ Rush confirmed for {promisedDate ? formatPortalDate(promisedDate) : "an unspecified date"}
          {confirmedByName ? ` — confirmed by ${confirmedByName}` : ""}
          {confirmedAt ? ` on ${formatPortalDateTime(confirmedAt)}` : ""}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-bold text-text-tertiary hover:text-red-700 underline disabled:opacity-60"
        >
          {pending ? "Un-confirming…" : "Change / un-confirm"}
        </button>
        {state.error && (
          <p role="alert" className="w-full text-xs text-red-800 m-0">
            {state.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="confirmed" value="true" />
      <label className="text-sm font-semibold">
        Promised date
        <input
          type="date"
          name="promisedDate"
          defaultValue={promisedDate ?? requestedDate ?? undefined}
          required
          className="block mt-1 border border-border rounded-sm px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-amber-700 text-white font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-60"
      >
        {pending ? "Confirming…" : "Confirm rush date"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-xs text-red-800 m-0">
          {state.error}
        </p>
      )}
    </form>
  );
}
