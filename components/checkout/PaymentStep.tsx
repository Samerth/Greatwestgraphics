"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Textarea } from "./FormField";
import { Button } from "@/components/shared/Button";

/**
 * No card fields here on purpose. This step used to render Card Number,
 * Expiry, CVC and Name on Card with `autocomplete="cc-number"`/`cc-csc`, on a
 * page whose own banner says no payment is collected. Nothing was ever sent
 * anywhere — `onSubmit` only forwards `studioNotes` — so the fields did
 * nothing except invite browsers and password managers to autofill and store
 * a real card, and put the storefront in PCI scope for data it had no
 * processor to hand off to. Payment lands via Stripe on the payment-ready
 * invoice.
 *
 * This step used to also offer Card / Apple Pay / Interac / Net-30 tabs, each
 * recording a "preference" nothing downstream read. Removed entirely (client
 * feedback: Net-30 is not a real offering, and the other three tabs added a
 * choice with no effect) — replaced with one sentence, since there is
 * genuinely nothing left to choose here. See also the FAQ and the CodChat
 * knowledge base, both of which said Net-30 was available and needed the
 * same correction.
 */
const reviewSchema = z.object({
  // The API caps `customerNote` at 4,000, so leave it room rather than let
  // the submission fail validation after the wizard is complete.
  studioNotes: z.string().max(3_800, "Keep notes under 3,800 characters").optional(),
});
type ReviewValues = z.infer<typeof reviewSchema>;

export function PaymentStep({
  onBack,
  onSubmit,
  error,
}: {
  onBack: () => void;
  onSubmit: (notes: string | undefined) => Promise<void>;
  error?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
  });

  return (
    <form
      onSubmit={handleSubmit(({ studioNotes }) =>
        onSubmit(studioNotes?.trim() || undefined),
      )}
    >
      <h2 className="font-display font-bold text-header mb-sp-2">Payment</h2>
      <p className="text-sm text-text-secondary mt-0 mb-sp-4">
        Today we still submit for design review — no charge is captured yet.
      </p>

      {/* Verbatim from the client (UAT row 49), replacing a longer notice
          they found too technical. */}
      <div
        data-checkout="no-payment-notice"
        className="border border-accent bg-accent-tint rounded-md p-sp-3 mb-sp-4 text-sm"
      >
        <b>No payment today</b> — submit your order for review and we&apos;ll
        confirm all details before payment.
      </div>

      {/* Card / Apple Pay / Interac / Net-30 tabs used to live here, each
          recording a "preference" nothing downstream ever read. Net-30 in
          particular was never a real offering — removed entirely rather than
          reworded, along with the same claim on the FAQ page and in the
          CodChat knowledge base (client feedback). Card details are still
          never collected here, on purpose: they're entered on the secure
          invoice sent once final pricing is confirmed. */}
      <div
        data-checkout="payment-method-notice"
        className="rounded-md border border-border bg-bg-raised p-sp-4 mb-sp-4 text-sm text-text-secondary"
      >
        Payment is arranged on the invoice, after your proof is approved —
        there&apos;s nothing to choose here.
      </div>

      <Field label="Notes to the Studio" error={errors.studioNotes?.message}>
        <Textarea
          rows={3}
          placeholder="Deadlines, PO numbers, artwork placement, anything our team should know before we proof."
          {...register("studioNotes")}
        />
      </Field>

      {error && (
        <div
          role="alert"
          className="border border-red-300 bg-red-50 text-red-800 rounded-md p-sp-3 mt-sp-3 text-sm"
        >
          {error} Your cart is still saved. Retry when ready.
        </div>
      )}

      <div className="flex justify-between mt-sp-4 gap-3 flex-wrap">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Submitting…"
            : error
              ? "Retry Submission"
              : "Submit for Review"}
        </Button>
      </div>
    </form>
  );
}
