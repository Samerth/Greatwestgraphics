"use client";

import { useActionState } from "react";
import { Button } from "@/components/shared/Button";
import {
  requestInvoiceAction,
  type InvoiceRequestState,
} from "@/app/portal/jobs/actions";

export function InvoiceRequest({
  jobId,
  alreadyRequested,
}: {
  jobId: string;
  alreadyRequested: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    InvoiceRequestState,
    FormData
  >(requestInvoiceAction.bind(null, jobId), {});

  if (alreadyRequested || state.ok) {
    return (
      <p className="text-sm text-text-secondary m-0">
        Invoice requested. We will send payment instructions to the email on
        this job.
      </p>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Requesting…" : "Request an invoice"}
      </Button>
    </form>
  );
}
