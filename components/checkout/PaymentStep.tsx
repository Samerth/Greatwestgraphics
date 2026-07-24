"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils/cn";
import { paymentSchema, type PaymentValues, type PaymentMethod } from "@/lib/schemas/checkout";
import { Field, Input, Textarea } from "./FormField";
import { Button } from "@/components/shared/Button";
import { money } from "@/lib/utils/quote-pricing";

const TABS: { key: PaymentMethod; label: string }[] = [
  { key: "card", label: "Card" },
  { key: "apple-pay", label: "Apple Pay" },
  { key: "interac", label: "Interac" },
  { key: "net-30", label: "Net-30" },
];

export function PaymentStep({
  deposit,
  onBack,
  onPlace,
}: {
  deposit: number;
  onBack: () => void;
  onPlace: (values: PaymentValues) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("card");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: "card" },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => onPlace({ ...values, method }))}
    >
      <h2 className="font-display font-bold text-header mb-sp-4">Payment</h2>

      <div className="flex gap-2 mb-sp-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMethod(t.key)}
            className={cn(
              "flex-1 border rounded-md py-2.5 font-bold text-sm text-center transition-colors",
              method === t.key
                ? "bg-accent text-white border-accent"
                : "border-border text-text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {method === "card" && (
        <>
          <Field label="Card Number" error={errors.cardNumber?.message}>
            <Input placeholder="1234 5678 9012 3456" invalid={!!errors.cardNumber} {...register("cardNumber")} />
          </Field>
          <div className="grid grid-cols-2 gap-sp-3">
            <Field label="Expiry" error={errors.expiry?.message}>
              <Input placeholder="MM / YY" invalid={!!errors.expiry} {...register("expiry")} />
            </Field>
            <Field label="CVC" error={errors.cvc?.message}>
              <Input placeholder="123" invalid={!!errors.cvc} {...register("cvc")} />
            </Field>
          </div>
          <Field label="Name on Card" error={errors.cardName?.message}>
            <Input placeholder="As it appears on the card" invalid={!!errors.cardName} {...register("cardName")} />
          </Field>
        </>
      )}

      {method !== "card" && (
        <div className="border border-border rounded-md p-sp-3 mb-sp-3 text-sm text-text-secondary">
          You&apos;ll be redirected to complete payment via{" "}
          {TABS.find((t) => t.key === method)?.label} at order confirmation.
        </div>
      )}

      <div className="bg-accent-tint border border-accent rounded-md p-sp-3 mb-sp-3 text-sm">
        ✓ Pay 50% deposit now ({money(deposit)}) — balance due on proof approval
      </div>

      <Field label="Notes to the Studio">
        <Textarea
          rows={3}
          placeholder="Deadlines, PO numbers, artwork placement, anything our team should know before we proof."
          {...register("studioNotes")}
        />
      </Field>

      <div className="flex justify-between mt-sp-4">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Placing order…" : "Approve & Place Order"}
        </Button>
      </div>
    </form>
  );
}
