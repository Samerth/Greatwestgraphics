"use client";

import { useActionState } from "react";
import { Button } from "@/components/shared/Button";
import {
  startCardPaymentAction,
  type CardPaymentState,
} from "@/app/portal/jobs/actions";

/**
 * Card payment for an accepted quote.
 *
 * Sits above the manual invoice request rather than replacing it: e-transfer
 * and cheque are still how a lot of this shop's accounts pay.
 */
export function PayNowButton({
  jobId,
  amountLabel,
  disabled,
}: {
  jobId: string;
  amountLabel?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<CardPaymentState, FormData>(
    startCardPaymentAction.bind(null, jobId),
    {},
  );

  return (
    <form action={formAction} className="mb-sp-3">
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || disabled} className="w-full">
        {pending
          ? "Opening secure checkout…"
          : amountLabel
            ? `Pay ${amountLabel} by card`
            : "Pay now by card"}
      </Button>
      <p className="text-xs text-text-secondary mt-1 mb-0">
        Secure payment handled by Stripe. You will come back here once it is done.
      </p>
    </form>
  );
}
