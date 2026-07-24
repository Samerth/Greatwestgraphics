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
      <h2 className="font-display font-bold text-header mb-sp-4">Delivery Speed</h2>

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
        <Button onClick={() => onNext(selected)}>Continue to Payment →</Button>
      </div>
    </div>
  );
}
