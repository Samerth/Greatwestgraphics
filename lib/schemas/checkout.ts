import { z } from "zod";

export const contactSchema = z.object({
  email: z.string().email("Enter a valid email"),
  fullName: z.string().min(2, "Enter your full name"),
  phone: z.string().min(7, "Enter a valid phone number"),
  company: z.string().optional(),
});
export type ContactValues = z.infer<typeof contactSchema>;

const CANADA_POSTAL_CODE = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
const US_ZIP_CODE = /^\d{5}(-\d{4})?$/;

/**
 * `country` is free text (`ShippingStep.tsx`'s Country field is an `<Input>`,
 * not a dropdown, defaulting to "Canada"), so the postal-code check has to
 * read what was actually typed rather than a code we control. Covers the
 * spellings a customer or a pasted address actually uses; anything else
 * falls through to "other" rather than guessing.
 */
function normalizedCountry(value: string): "CA" | "US" | "other" {
  const key = value.trim().toLowerCase().replace(/[.\s]/g, "");
  if (["canada", "ca", "can"].includes(key)) return "CA";
  if (["unitedstates", "unitedstatesofamerica", "us", "usa"].includes(key)) {
    return "US";
  }
  return "other";
}

export const shippingSchema = z
  .object({
    address1: z.string().min(3, "Street address is required"),
    address2: z.string().optional(),
    city: z.string().min(2, "City is required"),
    region: z.string().min(2, "Province is required"),
    // Format is checked below, once the country is known — a Canadian
    // format enforced on every address regardless of country used to make a
    // real Seattle address (98101) impossible to enter on a site that
    // promises shipping "anywhere in Canada and the United States".
    postalCode: z.string().min(1, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
    notes: z.string().optional(),
    sameBilling: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const country = normalizedCountry(data.country);
    if (country === "CA" && !CANADA_POSTAL_CODE.test(data.postalCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["postalCode"],
        message: "Format: V6A 1A1",
      });
    } else if (country === "US" && !US_ZIP_CODE.test(data.postalCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["postalCode"],
        message: "Format: 98101 or 98101-1234",
      });
    } else if (country === "other" && data.postalCode.trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["postalCode"],
        message: "Enter a valid postal code",
      });
    }
  });
export type ShippingValues = z.infer<typeof shippingSchema>;

export type PaymentMethod = "card" | "apple-pay" | "interac" | "net-30";

export const paymentSchema = z
  .object({
    method: z.enum(["card", "apple-pay", "interac", "net-30"]),
    cardNumber: z.string().optional(),
    expiry: z.string().optional(),
    cvc: z.string().optional(),
    cardName: z.string().optional(),
    studioNotes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method !== "card") return;
    if (!data.cardNumber || data.cardNumber.replace(/\s/g, "").length < 15) {
      ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Enter a valid card number" });
    }
    if (!data.expiry || !/^\d{2}\s?\/\s?\d{2}$/.test(data.expiry)) {
      ctx.addIssue({ code: "custom", path: ["expiry"], message: "Format: MM / YY" });
    }
    if (!data.cvc || data.cvc.length < 3) {
      ctx.addIssue({ code: "custom", path: ["cvc"], message: "Enter a valid CVC" });
    }
    if (!data.cardName || data.cardName.length < 2) {
      ctx.addIssue({ code: "custom", path: ["cardName"], message: "Enter the name on the card" });
    }
  });
export type PaymentValues = z.infer<typeof paymentSchema>;

export type DeliveryKey = "standard" | "priority" | "rush" | "pickup";

/*
 * A `DELIVERY_FEES` map lived here, charging $28 for "Priority Line" and $149
 * for "Rush 48-Hour". Both were production speeds sold as delivery methods,
 * which row 49 removed, and row 50 forbids pricing a rush at checkout at all
 * — so there is no fee table left to keep. `priority` and `rush` survive on
 * `DeliveryKey` only so orders placed before the change still read back.
 */

/** Free shipping starts here, before tax. Confirmed by the client on 13
 *  September 2026: "Free shipping over $300 across Canada." */
export const FREE_SHIPPING_THRESHOLD = 300;

export const FREE_SHIPPING_BANNER = `FREE SHIPPING ON ORDERS $${FREE_SHIPPING_THRESHOLD}+`;

export const DELIVERY_OPTIONS: {
  key: DeliveryKey;
  name: string;
  eta: string;
  detail: string;
  price: string;
}[] = [
  {
    key: "standard",
    name: "Ship My Order",
    eta: "Canada-wide shipping",
    detail: `Free shipping on orders $${FREE_SHIPPING_THRESHOLD}+ before tax. Under $${FREE_SHIPPING_THRESHOLD}, shipping is calculated and confirmed after we review your order.`,
    price: "",
  },
  {
    key: "pickup",
    name: "Free Vancouver Pickup",
    eta: "Collect from our Vancouver studio",
    detail:
      "We will let you know as soon as your order is ready to collect. Pickup address is confirmed with your proof.",
    price: "FREE",
  },
];

/**
 * What the order summary should say on the shipping line.
 *
 * Under the threshold it must read "To be confirmed" and must *not* show $0 or
 * Free — the client was explicit about that, because showing a zero would read
 * as a promise we have not made and cannot keep on a small order.
 */
export type ShippingState =
  | { kind: "pickup"; label: string; includedInTotal: true }
  | { kind: "free"; label: string; includedInTotal: true }
  | { kind: "to-be-confirmed"; label: string; includedInTotal: false };

export function shippingStateFor(
  deliveryKey: DeliveryKey,
  subtotalBeforeTax: number,
): ShippingState {
  if (deliveryKey === "pickup") {
    return { kind: "pickup", label: "FREE", includedInTotal: true };
  }
  if (subtotalBeforeTax >= FREE_SHIPPING_THRESHOLD) {
    return { kind: "free", label: "FREE", includedInTotal: true };
  }
  // Nothing is added to the estimate until GWG has quoted it.
  return {
    kind: "to-be-confirmed",
    label: "To be confirmed",
    includedInTotal: false,
  };
}

/* ---------------------------------------------------------------------- *
 * Turnaround (CodSphere UAT V2 row 50)
 * ---------------------------------------------------------------------- */

export type TurnaroundKind = "standard" | "rush";

export const STANDARD_TURNAROUND_LABEL = "Standard Production — 5–7 Business Days";
export const STANDARD_TURNAROUND_NOTE = "No additional charge.";
export const RUSH_TURNAROUND_LABEL = "Request Rush Production";
export const RUSH_DATE_PROMPT = "When do you need your order?";

/** Verbatim from the client. Reproduced exactly because it sets expectations
 *  about a date we have not agreed to yet. */
export const RUSH_DISCLAIMER =
  "Rush availability and pricing depend on your order requirements and our current production schedule. A Great West Graphics customer service representative will contact you to confirm the requested date and any applicable rush charges. Selecting a date does not guarantee completion by that date.";

/** Shown to staff, and to the customer on their own order. */
export const RUSH_FEE_LABEL = "To Be Confirmed";
export const RUSH_FLAG_LABEL = "RUSH REQUEST";

/** Earliest date the picker accepts — tomorrow, in the browser's timezone.
 *  A rush for today is not a production request, it is a typo. */
export function earliestRushDate(today = new Date()): string {
  const next = new Date(today);
  next.setDate(next.getDate() + 1);
  return toIsoDate(next);
}

export function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

/** `2026-09-22` → `Sept 22, 2026`, for summaries and the admin job page. */
export function formatRequestedDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  // Built from the parts rather than `new Date(iso)`, which parses a bare
  // ISO date as UTC midnight and can render as the previous day west of
  // Greenwich — which is exactly where Vancouver is.
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
