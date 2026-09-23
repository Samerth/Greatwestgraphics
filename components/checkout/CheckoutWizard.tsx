"use client";

import {
  CommerceErrorResponseSchema,
  JobRequestResponseSchema,
  type JobRequestResponse,
  type StorefrontJobSubmission,
} from "@gwg/contracts";
import { useEffect, useRef, useState } from "react";
import { StepPills } from "./StepPills";
import { ContactStep } from "./ContactStep";
import { ShippingStep } from "./ShippingStep";
import { DeliveryStep, PickupStep } from "./DeliveryStep";
import { TurnaroundStep, type TurnaroundSelection } from "./TurnaroundStep";
import { PaymentStep } from "./PaymentStep";
import { CheckoutSummary } from "./CheckoutSummary";
import { CheckoutSuccess } from "./CheckoutSuccess";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics/gtag";
import {
  computeCartTotals,
  useCartStore,
  useVisibleCartItems,
} from "@/lib/store/cart";
import { checkoutLineTotalMinor } from "@/lib/commerce/checkout-line-total";
import type {
  ContactValues,
  ShippingValues,
  DeliveryKey,
} from "@/lib/schemas/checkout";

interface CheckoutData {
  contact?: ContactValues;
  shipping?: ShippingValues;
  pickupNotes?: string;
  delivery: DeliveryKey;
  turnaround: TurnaroundSelection;
}

export function CheckoutWizard({
  sessionContact,
}: {
  /** The signed-in customer's account name and email, so the contact step
   *  does not ask for them again from scratch. Only a default: a contact
   *  already saved from an earlier visit to this step (in `data.contact`,
   *  restored from localStorage below) always wins over this. */
  sessionContact?: { fullName: string; email: string };
} = {}) {
  const items = useVisibleCartItems();
  const clearCart = useCartStore((s) => s.clear);

  const [step, setStep] = useState(1);
  // Defaults to shipping and standard production: the delivery step no
  // longer sells "priority", and nobody should arrive at checkout already
  // holding a rush request they did not ask for.
  const [data, setData] = useState<CheckoutData>({
    delivery: "standard",
    turnaround: { kind: "standard" },
  });
  const [placed, setPlaced] = useState<JobRequestResponse>();
  const [submissionError, setSubmissionError] = useState<string>();
  const checkoutTracked = useRef(false);

  useEffect(() => {
    if (checkoutTracked.current || placed || items.length === 0) return;
    checkoutTracked.current = true;
    const totals = computeCartTotals(items);
    trackBeginCheckout({
      value: Number(totals.total.toFixed(2)),
      currency: "CAD",
      items: items.length,
    });
  }, [items, placed]);

  useEffect(() => {
    const saved = window.localStorage.getItem("gwg-checkout-details");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<CheckoutData>;
      setData({
        ...parsed,
        // A checkout left open across this change can hold a delivery method
        // that is no longer offered, and will hold no turnaround at all.
        // Both are repaired on the way in rather than rendering a step with
        // nothing selected.
        delivery: parsed.delivery === "pickup" ? "pickup" : "standard",
        turnaround:
          parsed.turnaround?.kind === "rush" && parsed.turnaround.requestedDate
            ? parsed.turnaround
            : { kind: "standard" },
      });
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
        <StepPills current={step} pickup={data.delivery === "pickup"} />

        {step === 1 && (
          <ContactStep
            defaultValues={data.contact ?? sessionContact ?? {}}
            onNext={(contact) => {
              setData((d) => ({ ...d, contact }));
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <DeliveryStep
            defaultValue={data.delivery}
            onBack={() => setStep(1)}
            onNext={(delivery) => {
              setData((d) => ({ ...d, delivery }));
              setStep(3);
            }}
          />
        )}

        {step === 3 && (
          <TurnaroundStep
            defaultValue={data.turnaround}
            nextLabel={
              data.delivery === "pickup"
                ? "Continue to Pickup →"
                : "Continue to Address →"
            }
            onBack={() => setStep(2)}
            onNext={(turnaround) => {
              setData((d) => ({ ...d, turnaround }));
              setStep(4);
            }}
          />
        )}

        {step === 4 && data.delivery === "pickup" && (
          <PickupStep
            defaultNotes={data.pickupNotes}
            onBack={() => setStep(3)}
            onNext={(pickupNotes) => {
              setData((d) => ({ ...d, pickupNotes, shipping: undefined }));
              setStep(5);
            }}
          />
        )}

        {step === 4 && data.delivery !== "pickup" && (
          <ShippingStep
            defaultValues={data.shipping ?? {}}
            onBack={() => setStep(3)}
            onNext={(shipping) => {
              setData((d) => ({ ...d, shipping }));
              setStep(5);
            }}
          />
        )}

        {step === 5 && (
          <PaymentStep
            onBack={() => setStep(4)}
            error={submissionError}
            onSubmit={async (customerNote) => {
              if (!data.contact) return;
              if (data.delivery !== "pickup" && !data.shipping) return;
              setSubmissionError(undefined);
              const { notes, sameBilling: _sameBilling, ...address } =
                data.shipping ?? {
                  notes: undefined,
                  sameBilling: true,
                  address1: "",
                  city: "",
                  region: "",
                  postalCode: "",
                  country: "",
                };
              const submissionWithoutKey = {
                contact: data.contact,
                fulfillment:
                  data.delivery === "pickup"
                    ? {
                        method: "pickup" as const,
                        deliveryNotes: data.pickupNotes || undefined,
                        turnaround: data.turnaround,
                      }
                    : {
                        method: data.delivery,
                        address,
                        deliveryNotes: notes || undefined,
                        // Carried on the order itself rather than buried in
                        // the customer note, so staff can flag and filter on
                        // a rush request instead of reading for it (row 50).
                        turnaround: data.turnaround,
                      },
                customerNote: customerNote || undefined,
                lines: items.map((item) => {
                  // A price that could not be computed on the Input Quantity
                  // step is never sent as 0 — that would read to staff as a
                  // free line rather than an unpriced one. Leaving both
                  // fields out is what the API already treats as "price this
                  // for real" (job-request-service.ts `repriceLine`: no
                  // snapshot means the line is flagged pricingUnverified,
                  // which is exactly what a `priceUnavailable` line is).
                  const unitPriceEstimateMinor = item.priceUnavailable
                    ? undefined
                    : Math.round(item.unit * 100);
                  // This line's own total — never read off the pricing
                  // snapshot's totalMinor, which is the whole run's combined
                  // total and is attached identically to every line a
                  // multi-colour order produces (see checkoutLineTotalMinor's
                  // own doc comment for the full story).
                  const lineTotalMinor = checkoutLineTotalMinor(
                    item.qty,
                    item.unit,
                    item.priceUnavailable,
                  );
                  return {
                    description: item.name,
                    quantity: item.qty,
                    unitPriceEstimateMinor,
                    lineTotalMinor,
                    currency: "CAD",
                    productId: item.productId,
                    variantId: item.variantId,
                    configuration: {
                      storefrontProductId: item.id,
                      productMetadata: item.meta,
                      color: item.color,
                      size: item.size,
                      image: item.image,
                      // Per line, because two lines can carry two different
                      // designs. This used to read a browser store that nothing
                      // ever wrote, so every order arrived with no artwork.
                      artworkProofUrl: item.artworkProofUrl,
                      // A frozen copy of this line's own design layout and
                      // colourway photos, so the admin job page and the
                      // portal can each redraw it on this line's actual
                      // colour instead of showing the flattened proof above,
                      // which is only ever one colour (see
                      // DesignLineThumbnail). Both omitted the same way
                      // artworkProofUrl already is when there is nothing to
                      // send.
                      designSnapshot: item.designSnapshot,
                      garmentPhotos: item.garmentPhotos,
                      designProjectId: item.designProjectId,
                      roster: item.roster,
                      designNotes: item.designNotes,
                      rosterDecor: item.rosterDecor,
                      // Sending the snapshot lets the API re-price the line
                      // against the config that is live right now, so a cart
                      // left open for a week can't lock in stale pricing.
                      pricing: item.pricingSnapshot,
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
                const totals = computeCartTotals(items);
                trackPurchase({
                  transaction_id: jobRequest.displayId,
                  value: Number(totals.total.toFixed(2)),
                  currency: "CAD",
                });
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

      <CheckoutSummary
        items={items}
        deliveryKey={data.delivery}
        turnaround={data.turnaround}
      />
    </div>
  );
}
