"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Textarea } from "./FormField";
import { Button } from "@/components/shared/Button";
import { cn } from "@/lib/utils/cn";
import { useVisibleCartItems } from "@/lib/store/cart";
import { DELIVERY_FEES, type DeliveryKey } from "@/lib/schemas/checkout";
import { money } from "@/lib/utils/quote-pricing";

/**
 * No card fields here on purpose. This step used to render Card Number,
 * Expiry, CVC and Name on Card with `autocomplete="cc-number"`/`cc-csc`, on a
 * page whose own banner says no payment is collected. Nothing was ever sent
 * anywhere — `onSubmit` only forwards `studioNotes` — so the fields did
 * nothing except invite browsers and password managers to autofill and store
 * a real card, and put the storefront in PCI scope for data it had no
 * processor to hand off to. Payment lands via Stripe on the payment-ready
 * invoice; until then this step captures a *preference* only, exactly as the
 * Apple Pay, Interac and Net-30 tabs already did.
 */
const reviewSchema = z.object({
  // The API caps `customerNote` at 4,000 and the payment-preference line is
  // prepended to whatever is typed here, so leave it room rather than let the
  // submission fail validation after the wizard is complete.
  studioNotes: z.string().max(3_800, "Keep notes under 3,800 characters").optional(),
  depositNow: z.boolean().optional(),
});
type ReviewValues = z.infer<typeof reviewSchema>;

type PayTab = "card" | "apple" | "interac" | "net30";

const TABS: Array<{ id: PayTab; label: string; note: string }> = [
  { id: "card", label: "Card", note: "Card" },
  { id: "apple", label: "Apple Pay", note: "Apple Pay" },
  { id: "interac", label: "Interac", note: "Interac e-Transfer" },
  { id: "net30", label: "Net-30", note: "Net-30 terms" },
];

/**
 * Folds the payment preference into the note that actually travels with the
 * job request.
 *
 * Every panel in this step promises the choice "tells the studio how you plan
 * to settle", and the deposit checkbox reads as a commitment. Neither `tab`
 * nor `depositNow` left the component: `onSubmit` was called with the free
 * text alone, so the studio saw a job request that never mentioned Net-30 or
 * the deposit. There is no field on the request contract for a payment
 * preference and inventing one would mean a schema, a migration and an admin
 * surface for something no processor reads yet, so it rides along in the
 * customer note the studio already reads.
 */
function buildCustomerNote(
  tab: PayTab,
  depositNow: boolean,
  studioNotes: string | undefined,
): string | undefined {
  const preference = TABS.find((item) => item.id === tab)?.note ?? tab;
  const deposit =
    tab === "card"
      ? depositNow
        ? " · 50% deposit on invoice"
        : " · prefers to pay in full on invoice"
      : "";
  const line = `Payment preference: ${preference}${deposit}`;
  const typed = studioNotes?.trim();
  return typed ? `${line}\n\n${typed}` : line;
}

export function PaymentStep({
  onBack,
  onSubmit,
  error,
  delivery = "priority",
}: {
  onBack: () => void;
  onSubmit: (notes: string | undefined) => Promise<void>;
  error?: string;
  delivery?: DeliveryKey;
}) {
  const items = useVisibleCartItems();
  const [tab, setTab] = useState<PayTab>("card");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { depositNow: true },
  });

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unit * item.qty, 0),
    [items],
  );
  const deliveryFee = DELIVERY_FEES[delivery] ?? 0;
  const estimated = subtotal + deliveryFee;
  const deposit = estimated * 0.5;
  const depositNow = useWatch({ control, name: "depositNow" });

  return (
    <form
      onSubmit={handleSubmit(({ studioNotes, depositNow: wantsDeposit }) =>
        onSubmit(buildCustomerNote(tab, wantsDeposit ?? false, studioNotes)),
      )}
    >
      <h2 className="font-display font-bold text-header mb-sp-2">Payment</h2>
      <p className="text-sm text-text-secondary mt-0 mb-sp-4">
        Choose how you&apos;d like to pay when the job is ready. Today we still
        submit for design review — no charge is captured yet.
      </p>

      <div className="border border-accent bg-accent-tint rounded-md p-sp-3 mb-sp-4 text-sm">
        <b>No payment is collected now.</b> Our team will review your design,
        confirm availability, and send final pricing before payment becomes
        available.
      </div>

      <div
        role="tablist"
        aria-label="Payment method"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-sp-4"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md border px-3 py-2.5 text-sm font-bold transition-colors",
              tab === item.id
                ? "border-accent bg-accent text-white"
                : "border-border bg-bg-raised hover:border-accent",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "card" && (
        <div className="space-y-sp-3 mb-sp-4">
          <div className="rounded-md border border-border bg-bg-raised p-sp-4 text-sm text-text-secondary">
            Card details are entered on the secure invoice we send once final
            pricing is confirmed — never here. Choosing Card now just tells the
            studio how you plan to settle.
          </div>
          <label className="flex items-start gap-3 text-sm cursor-pointer rounded-md border border-border bg-bg-raised p-sp-3">
            <input type="checkbox" className="mt-1" {...register("depositNow")} />
            <span>
              Pay 50% deposit on the invoice ({money(deposit)}) — balance due on
              proof approval
              {!depositNow ? (
                <span className="block text-text-tertiary mt-1">
                  Optional preference noted; still no charge until payment-ready.
                </span>
              ) : null}
            </span>
          </label>
        </div>
      )}

      {tab === "apple" && (
        <div className="rounded-md border border-border bg-bg-raised p-sp-4 mb-sp-4 text-sm text-text-secondary">
          Apple Pay will be offered on the payment-ready invoice for supported
          devices. Preferencing it here tells the studio how you plan to settle.
        </div>
      )}

      {tab === "interac" && (
        <div className="rounded-md border border-border bg-bg-raised p-sp-4 mb-sp-4 text-sm text-text-secondary">
          Interac e-Transfer instructions are sent with final pricing. Use this
          option for Canadian business accounts that prefer bank transfer.
        </div>
      )}

      {tab === "net30" && (
        <div className="rounded-md border border-border bg-bg-raised p-sp-4 mb-sp-4 text-sm text-text-secondary">
          Net-30 is available for approved corporate accounts. Mention your
          account code in the studio notes below and we&apos;ll confirm eligibility
          during review.
        </div>
      )}

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
