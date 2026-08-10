"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Textarea } from "./FormField";
import { Button } from "@/components/shared/Button";
import { cn } from "@/lib/utils/cn";
import { useCartStore } from "@/lib/store/cart";
import { DELIVERY_FEES, type DeliveryKey } from "@/lib/schemas/checkout";
import { money } from "@/lib/utils/quote-pricing";

const reviewSchema = z.object({
  studioNotes: z.string().max(4_000, "Keep notes under 4,000 characters").optional(),
  cardNumber: z.string().optional(),
  expiry: z.string().optional(),
  cvc: z.string().optional(),
  nameOnCard: z.string().optional(),
  depositNow: z.boolean().optional(),
});
type ReviewValues = z.infer<typeof reviewSchema>;

type PayTab = "card" | "apple" | "interac" | "net30";

const TABS: Array<{ id: PayTab; label: string }> = [
  { id: "card", label: "Card" },
  { id: "apple", label: "Apple Pay" },
  { id: "interac", label: "Interac" },
  { id: "net30", label: "Net-30" },
];

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
  const items = useCartStore((s) => s.items);
  const [tab, setTab] = useState<PayTab>("card");
  const {
    register,
    handleSubmit,
    watch,
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
  const depositNow = watch("depositNow");

  return (
    <form onSubmit={handleSubmit(({ studioNotes }) => onSubmit(studioNotes))}>
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
          <Field label="Card Number">
            <Input
              placeholder="1234 5678 9012 3456"
              inputMode="numeric"
              autoComplete="cc-number"
              {...register("cardNumber")}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3">
            <Field label="Expiry">
              <Input
                placeholder="MM / YY"
                autoComplete="cc-exp"
                {...register("expiry")}
              />
            </Field>
            <Field label="CVC">
              <Input
                placeholder="123"
                inputMode="numeric"
                autoComplete="cc-csc"
                {...register("cvc")}
              />
            </Field>
          </div>
          <Field label="Name on Card">
            <Input
              placeholder="As it appears on the card"
              autoComplete="cc-name"
              {...register("nameOnCard")}
            />
          </Field>
          <label className="flex items-start gap-3 text-sm cursor-pointer rounded-md border border-border bg-bg-raised p-sp-3">
            <input type="checkbox" className="mt-1" {...register("depositNow")} />
            <span>
              Pay 50% deposit now ({money(deposit)}) — balance due on proof
              approval
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
