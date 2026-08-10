"use client";

import {
  CommerceErrorResponseSchema,
  JobRequestResponseSchema,
  type JobRequestResponse,
  type StorefrontJobSubmission,
} from "@gwg/contracts";
import { useEffect, useState } from "react";
import { StepPills } from "./StepPills";
import { ContactStep } from "./ContactStep";
import { ShippingStep } from "./ShippingStep";
import { DeliveryStep } from "./DeliveryStep";
import { PaymentStep } from "./PaymentStep";
import { CheckoutSummary } from "./CheckoutSummary";
import { CheckoutSuccess } from "./CheckoutSuccess";
import { useCartStore } from "@/lib/store/cart";
import { loadDesignProofs } from "@/lib/commerce/design-attachment";
import type {
  ContactValues,
  ShippingValues,
  DeliveryKey,
} from "@/lib/schemas/checkout";

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
  const [placed, setPlaced] = useState<JobRequestResponse>();
  const [submissionError, setSubmissionError] = useState<string>();

  useEffect(() => {
    const saved = window.localStorage.getItem("gwg-checkout-details");
    if (!saved) return;
    try {
      setData(JSON.parse(saved) as CheckoutData);
    } catch {
      window.localStorage.removeItem("gwg-checkout-details");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("gwg-checkout-details", JSON.stringify(data));
  }, [data]);

  if (placed) return <CheckoutSuccess jobRequest={placed} />;

  if (items.length === 0) {
    return (
      <p className="text-text-secondary">
        Your cart is empty — add something from the shop before checking out.
      </p>
    );
  }

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
            onBack={() => setStep(3)}
            delivery={data.delivery}
            error={submissionError}
            onSubmit={async (customerNote) => {
              if (!data.contact || !data.shipping) return;
              setSubmissionError(undefined);
              const { notes, sameBilling: _sameBilling, ...address } = data.shipping;
              const submissionWithoutKey = {
                contact: data.contact,
                fulfillment: {
                  method: data.delivery,
                  address,
                  deliveryNotes: notes || undefined,
                },
                customerNote: customerNote || undefined,
                lines: items.map((item) => {
                  const proofs = loadDesignProofs();
                  const designProofs =
                    proofs?.front || proofs?.back
                      ? { front: proofs.front, back: proofs.back }
                      : undefined;
                  return {
                    description: item.name,
                    quantity: item.qty,
                    unitPriceEstimateMinor: Math.round(item.unit * 100),
                    currency: "CAD",
                    productId: item.productId,
                    variantId: item.variantId,
                    configuration: {
                      storefrontProductId: item.id,
                      productMetadata: item.meta,
                      color: item.color,
                      size: item.size,
                      image: item.image,
                      designProofs,
                    },
                  };
                }),
              } satisfies Omit<StorefrontJobSubmission, "idempotencyKey">;
              const fingerprint = JSON.stringify(submissionWithoutKey);
              const savedKey = window.localStorage.getItem("gwg-submission-key");
              let idempotencyKey = crypto.randomUUID();
              if (savedKey) {
                try {
                  const saved = JSON.parse(savedKey) as {
                    fingerprint: string;
                    key: string;
                  };
                  if (saved.fingerprint === fingerprint) idempotencyKey = saved.key;
                } catch {
                  // Replace malformed local retry state below.
                }
              }
              window.localStorage.setItem(
                "gwg-submission-key",
                JSON.stringify({ fingerprint, key: idempotencyKey }),
              );

              try {
                const response = await fetch("/api/commerce/job-requests", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    ...submissionWithoutKey,
                    idempotencyKey,
                  }),
                });
                const payload: unknown = await response.json();
                if (!response.ok) {
                  const parsedError = CommerceErrorResponseSchema.safeParse(payload);
                  throw new Error(
                    parsedError.success
                      ? parsedError.data.error.message
                      : "The submission could not be completed.",
                  );
                }
                const jobRequest = JobRequestResponseSchema.parse(payload);
                setPlaced(jobRequest);
                clearCart();
                window.localStorage.removeItem("gwg-submission-key");
              } catch (error) {
                setSubmissionError(
                  error instanceof Error
                    ? error.message
                    : "The submission could not be completed.",
                );
              }
            }}
          />
        )}
      </div>

      <CheckoutSummary items={items} deliveryKey={data.delivery} />
    </div>
  );
}
