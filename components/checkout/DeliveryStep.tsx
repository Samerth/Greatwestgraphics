"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { DELIVERY_OPTIONS, DELIVERY_FEES, type DeliveryKey } from "@/lib/schemas/checkout";
import { money } from "@/lib/utils/quote-pricing";

export function DeliveryStep({
  defaultValue,
  onNext,
  onBack,
}: {
  defaultValue: DeliveryKey;
  onNext: (key: DeliveryKey) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<DeliveryKey>(defaultValue);

  return (
    <div>
      <h2 className="font-display font-bold text-header mb-sp-4">Fulfilment</h2>

      {DELIVERY_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => setSelected(opt.key)}
          className={cn(
            "w-full border rounded-md p-sp-3 mb-2.5 flex justify-between items-center gap-sp-3 text-left transition-colors",
            selected === opt.key
              ? "border-accent bg-accent-tint"
              : "border-border hover:border-text-tertiary"
          )}
        >
          <div className="flex items-center gap-sp-3">
            <span
              className={cn(
                "w-[18px] h-[18px] rounded-full border-2 relative shrink-0",
                selected === opt.key ? "border-accent" : "border-border"
              )}
            >
              {selected === opt.key && (
                <span className="absolute inset-[3px] rounded-full bg-accent" />
              )}
            </span>
            <div>
              <div className="font-bold text-[14.5px] flex items-center gap-2">
                {opt.name}
                {opt.badge && (
                  <span className="bg-accent text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full uppercase">
                    {opt.badge}
                  </span>
                )}
              </div>
              <div className="text-[13px] text-text-secondary">{opt.eta}</div>
            </div>
          </div>
          <div className="font-bold text-[14.5px]">
            {DELIVERY_FEES[opt.key] === 0 ? "Free" : money(DELIVERY_FEES[opt.key])}
          </div>
        </button>
      ))}

      <div className="flex justify-between mt-sp-4">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={() => onNext(selected)}>Continue →        </Button>
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
