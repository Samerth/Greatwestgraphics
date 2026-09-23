"use client";

import { useActionState, useEffect, useState } from "react";
import { saveInternalNoteAction, type InternalNoteState } from "@/app/admin/actions";
import { formatPortalDateTime } from "@/lib/commerce/portal-progress";

const initialState: InternalNoteState = {};

/** The client's own words: "a note attached to the order so production/
 *  admin staff can see important information about that specific job" —
 *  one shared scratchpad, last writer wins, never shown to the customer
 *  (enforced server-side by `redactStaffOnlyFields`, not by this form). */
export function JobInternalNoteForm({
  jobId,
  note,
  updatedAt,
  updatedByName,
}: {
  jobId: string;
  note: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveInternalNoteAction, initialState);
  const [value, setValue] = useState(note ?? "");

  useEffect(() => {
    setValue(note ?? "");
  }, [note]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <label className="block text-sm font-semibold">
        Internal note
        <span className="block font-normal text-xs text-text-tertiary mt-0.5">
          Not visible to the customer.
        </span>
        <textarea
          name="note"
          rows={4}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Anything the next person picking this up should know…"
          className="block mt-1 w-full border border-border rounded-sm px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
        {updatedAt && (
          <span className="text-xs text-text-tertiary">
            Last updated {formatPortalDateTime(updatedAt)}
            {updatedByName ? ` by ${updatedByName}` : ""}
          </span>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0">
          {state.error}
        </p>
      )}
      {!state.error && state.savedAt && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-sm px-3 py-2 m-0">
          Saved.
        </p>
      )}
    </form>
  );
}
