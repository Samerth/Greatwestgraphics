"use client";

import { useActionState } from "react";
import { createProofAction, type ProofUploadState } from "@/app/admin/actions";

const initialState: ProofUploadState = {};

export function ProofUploadForm({
  jobId,
  customerPersonId,
}: {
  jobId: string;
  customerPersonId: string;
}) {
  const [state, formAction, pending] = useActionState(createProofAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="customerPersonId" value={customerPersonId} />
      <label className="block text-sm font-semibold">
        Proof file
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,application/pdf"
          required
          className="block mt-1 w-full text-sm"
        />
      </label>
      <label className="block text-sm font-semibold">
        Note
        <input
          name="note"
          className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
        />
      </label>
      {state.error && (
        <p
          role="alert"
          className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-white font-bold px-4 py-2 rounded-sm disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Attach proof"}
      </button>
    </form>
  );
}