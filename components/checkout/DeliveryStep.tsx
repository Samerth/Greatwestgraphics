"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import {
  DELIVERY_OPTIONS,
  FREE_SHIPPING_BANNER,
  type DeliveryKey,
} from "@/lib/schemas/checkout";

/**
 * Delivery only (CodSphere UAT V2 row 49).
 *
 * "Standard Studio", "Priority Line" and "Rush 48-Hour" used to sit in this
 * list. They are production speeds, not ways of getting the parcel to the
 * customer, and pricing them here meant a shopper bought a turnaround while
 * thinking about shipping. Turnaround is now its own step, and this one asks
 * a single question: do we ship it, or do you collect it.
 */
export function DeliveryStep({
  defaultValue,
  onNext,
  onBack,
}: {
  defaultValue: DeliveryKey;
  onNext: (key: DeliveryKey) => void;
  onBack: () => void;
}) {
  // A legacy cart can arrive holding "priority" or "rush"; neither is on
  // offer any more, so both land on shipping rather than on nothing.
  const [selected, setSelected] = useState<DeliveryKey>(
    defaultValue === "pickup" ? "pickup" : "standard",
  );

  return (
    <div>
      <h2 className="font-display font-bold text-header mb-sp-3">
        Delivery Method
      </h2>

      {/* The threshold is the thing the client wanted impossible to miss, so
          it sits above the options rather than inside one of them. */}
      <p
        data-checkout="free-shipping-banner"
        className="m-0 mb-sp-4 rounded-md bg-accent px-sp-3 py-2.5 text-center text-[14px] font-bold tracking-[0.04em] text-white"
      >
        {FREE_SHIPPING_BANNER}
      </p>

      {DELIVERY_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setSelected(opt.key)}
          aria-pressed={selected === opt.key}
          className={cn(
            "w-full border rounded-md p-sp-3 mb-2.5 flex justify-between items-start gap-sp-3 text-left transition-colors",
            selected === opt.key
              ? "border-accent bg-accent-tint"
              : "border-border hover:border-text-tertiary",
          )}
        >
          <div className="flex items-start gap-sp-3 min-w-0">
            <span
              className={cn(
                "w-[18px] h-[18px] rounded-full border-2 relative shrink-0 mt-0.5",
                selected === opt.key ? "border-accent" : "border-border",
              )}
            >
              {selected === opt.key && (
                <span className="absolute inset-[3px] rounded-full bg-accent" />
              )}
            </span>
            <div className="min-w-0">
              <div className="font-bold text-[14.5px]">{opt.name}</div>
              <div className="text-[13px] text-text-secondary">{opt.eta}</div>
              <div className="text-[12.5px] text-text-tertiary mt-1 leading-snug">
                {opt.detail}
              </div>
            </div>
          </div>
          {opt.price ? (
            <div className="font-bold text-[14.5px] shrink-0">{opt.price}</div>
          ) : null}
        </button>
      ))}

      <div className="flex justify-between mt-sp-4">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={() => onNext(selected)}>Continue to Turnaround →</Button>
      </div>
    </div>
  );
}

export function PickupStep({
  defaultNotes,
  onNext,
  onBack,
}: {
  defaultNotes?: string;
  onNext: (notes: string | undefined) => void;
  onBack: () => void;
}) {
  const [notes, setNotes] = useState(defaultNotes ?? "");

  return (
    <div>
      <h2 className="font-display font-bold text-header mb-sp-2">
        Studio pickup
      </h2>
      <p className="text-sm text-text-secondary mt-0 mb-sp-4">
        We will hold the finished order at our Vancouver studio. No shipping
        address is needed.
      </p>
      <label className="block text-sm font-semibold">
        Pickup notes (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Who will collect, preferred window, etc."
          className="block mt-1 w-full border border-border rounded-sm px-2 py-1 font-normal"
        />
      </label>
      <div className="flex justify-between mt-sp-4">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={() => onNext(notes.trim() || undefined)}>
          Review Submission →
        </Button>
      </div>
    </div>
  );
}
