"use client";

import { useState } from "react";
import { StepPills } from "./StepPills";
import { ContactStep } from "./ContactStep";
import { ShippingStep } from "./ShippingStep";
import { DeliveryStep } from "./DeliveryStep";
import { PaymentStep } from "./PaymentStep";
import { CheckoutSummary } from "./CheckoutSummary";
import { CheckoutSuccess } from "./CheckoutSuccess";
import { useCartStore, computeCartTotals } from "@/lib/store/cart";
import type {
  ContactValues,
  ShippingValues,
  PaymentValues,
  DeliveryKey,
} from "@/lib/schemas/checkout";
import { DELIVERY_FEES } from "@/lib/schemas/checkout";

interface CheckoutData {
  contact?: ContactValues;
  shipping?: ShippingValues;
  delivery: DeliveryKey;
}

export function CheckoutWizard() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<CheckoutData>({ delivery: "priority" });
  const [placed, setPlaced] = useState(false);

  if (placed) return <CheckoutSuccess />;

  if (items.length === 0) {
    return (
      <p className="text-text-secondary">
        Your cart is empty — add something from the shop before checking out.
      </p>
    );
  }

  const deposit = computeCartTotals(items, DELIVERY_FEES[data.delivery]).deposit;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-sp-5 items-start">
      <div>
        <StepPills current={step} />

        {step === 1 && (
          <ContactStep
            defaultValues={data.contact ?? {}}
            onNext={(contact) => {
              setData((d) => ({ ...d, contact }));
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <ShippingStep
            defaultValues={data.shipping ?? {}}
            onBack={() => setStep(1)}
            onNext={(shipping) => {
              setData((d) => ({ ...d, shipping }));
              setStep(3);
            }}
          />
        )}

        {step === 3 && (
          <DeliveryStep
            defaultValue={data.delivery}
            onBack={() => setStep(2)}
            onNext={(delivery) => {
              setData((d) => ({ ...d, delivery }));
              setStep(4);
            }}
          />
        )}

        {step === 4 && (
          <PaymentStep
            deposit={deposit}
            onBack={() => setStep(3)}
            onPlace={(_payment: PaymentValues) => {
              // TODO: submit order to backend here (and eventually to
              // SanMar's Purchase Order service once EDI access is live).
              clearCart();
              setPlaced(true);
            }}
          />
        )}
      </div>

      <CheckoutSummary items={items} deliveryKey={data.delivery} />
    </div>
  );
}
