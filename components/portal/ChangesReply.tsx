"use client";

import { useActionState } from "react";
import { Button } from "@/components/shared/Button";
import {
  respondToChangesAction,
  type ChangeReplyState,
} from "@/app/portal/jobs/actions";

export function ChangesReply({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<
    ChangeReplyState,
    FormData
  >(respondToChangesAction.bind(null, jobId), {});

  return (
    <form action={formAction} className="space-y-sp-3">
      <p className="text-sm text-text-secondary m-0">
        Tell us what you changed. You can also attach replacement artwork.
      </p>
      <label className="block text-sm font-semibold">
        Your reply
        <textarea
          name="note"
          required
          rows={4}
          className="block mt-1 w-full border border-border rounded-sm px-2 py-1 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold">
        Replacement artwork (optional)
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="block mt-1 w-full text-sm font-normal"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-error m-0">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send revision"}
      </Button>
    </form>
  );
}
