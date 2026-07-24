import { z } from "zod";

export const contactSchema = z.object({
  email: z.string().email("Enter a valid email"),
  fullName: z.string().min(2, "Enter your full name"),
  phone: z.string().min(7, "Enter a valid phone number"),
  company: z.string().optional(),
});
export type ContactValues = z.infer<typeof contactSchema>;

export const shippingSchema = z.object({
  address1: z.string().min(3, "Street address is required"),
  address2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  region: z.string().min(2, "Province is required"),
  postalCode: z
    .string()
    .min(6, "Enter a valid postal code")
    .regex(/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/, "Format: V6A 1A1"),
  country: z.string().min(2, "Country is required"),
  notes: z.string().optional(),
  sameBilling: z.boolean().default(true),
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

// Ported 1:1 from DELIVERY_FEES in the original script.js
export const DELIVERY_FEES: Record<DeliveryKey, number> = {
  standard: 0,
  priority: 28,
  rush: 149,
  pickup: 0,
};

export const DELIVERY_OPTIONS: {
  key: DeliveryKey;
  name: string;
  eta: string;
  badge?: string;
}[] = [
  { key: "standard", name: "Standard Studio", eta: "5–7 business days" },
  { key: "priority", name: "Priority Line", eta: "3–4 business days", badge: "Popular" },
  { key: "rush", name: "Rush 48-Hour", eta: "Ready in 2 business days" },
  { key: "pickup", name: "Studio Pickup", eta: "Pick up at our Vancouver studio" },
];
