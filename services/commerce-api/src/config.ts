import { z } from "zod";

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    COMMERCE_API_HOST: z.string().default("127.0.0.1"),
    COMMERCE_API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    ENABLE_DEV_ADMIN_ROUTES: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DEV_ADMIN_TOKEN: z.string().min(16).optional(),
    /**
     * Shared secret proving a caller is the web tier. Without it the service
     * cannot authenticate anyone in production and every tenant-scoped route
     * refuses to answer.
     */
    COMMERCE_SERVICE_TOKEN: z.string().min(32).optional(),
    /**
     * Enables the admin API outside development. Separate from the service
     * token so that leaking the storefront's credential does not also hand
     * over pricing publication and catalogue editing.
     */
    ADMIN_API_TOKEN: z.string().min(32).optional(),
    /**
     * Notification delivery. Without RESEND_API_KEY the dispatcher leaves
     * events queued rather than marking them sent, so wiring the key up later
     * still delivers the backlog instead of silently dropping it.
     */
    RESEND_API_KEY: z.string().optional(),
    /**
     * Must be on a domain verified in Resend. The previous default was Resend's
     * shared `onboarding@resend.dev`, which only delivers to the Resend account
     * owner — so proof notifications to customers were rejected outright while
     * the dispatcher looked healthy. Defaulting to the real sending identity
     * means a missing variable degrades to "verify the domain" rather than to
     * "silently reach nobody".
     */
    NOTIFICATIONS_FROM_EMAIL: z
      .string()
      .default("Great West Graphics <noreply@greatwestgraphics.com>"),
    /** Where customer-side activity is announced. Unset means staff get no mail. */
    STAFF_NOTIFICATION_EMAIL: z.string().email().optional(),
    /** Used to build the portal and admin links inside notification emails. */
    SITE_BASE_URL: z.string().url().default("http://localhost:3000"),
    /**
     * Domain under which a store's slug doubles as its subdomain, so that
     * `acme.stores.example.com` resolves the store with slug `acme`. Leaving
     * it unset — the case for every environment that serves a single store —
     * means `/v1/stores/by-host` only answers for a registered custom domain,
     * and an unknown host resolves to nothing rather than to whichever store
     * shares its first label.
     */
    COMMERCE_STOREFRONT_BASE_DOMAIN: z.string().min(1).optional(),
    OUTBOX_DISPATCH_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    OUTBOX_POLL_MS: z.coerce.number().int().min(1_000).default(30_000),
    /**
     * Card payments. Absent, `/v1/job-requests/:id/checkout-session` answers
     * 503 and the portal simply does not offer the card button — the manual
     * invoice path keeps working, which is how this shop ran before Stripe.
     */
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    /**
     * Verifies the webhook. Verification lives in the web tier (it has the raw
     * body), so this belongs to whichever process serves /api/stripe/webhook;
     * it is declared here too so a deployment that moves the webhook onto this
     * service does not need a schema change.
     */
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    SS_ACCOUNT_NUMBER: z.string().optional(),
    SS_API_KEY: z.string().optional(),
    SS_API_BASE_URL: z
      .string()
      .url()
      .default("https://api-ca.ssactivewear.com"),
    SANMAR_ACCOUNT_ID: z.string().optional(),
    /**
     * SanMar Canada login e-mail — this is the PromoStandards "password" field
     * per ATC_Pstd_IntegrationGuide_2025 (not the website password).
     */
    SANMAR_LOGIN_EMAIL: z.string().email().optional(),
    /** Legacy alias for SANMAR_LOGIN_EMAIL (must be an e-mail). */
    SANMAR_API_PASSWORD: z.string().optional(),
    SANMAR_API_BASE_URL: z
      .string()
      .url()
      .default("https://edi.atc-apparel.com")
      .optional(),
    /** Directory with products.csv + skus.csv (+ optional inventory.csv). */
    SANMAR_CSV_DIR: z.string().optional(),
    /** Comma-separated style IDs; skips ACTIVE sellable discovery when set. */
    SANMAR_PRODUCT_IDS: z.string().optional(),
    /** Cap getProduct enrichment (names/images), not sellable import. */
    SANMAR_MAX_PRODUCTS: z.string().optional(),
    /** Cap per-style inventory/pricing fallback (unset = all styles). */
    SANMAR_INVENTORY_MAX: z.string().optional(),
    SANMAR_SELLABLE_MODE: z.enum(["ACTIVE", "ALL"]).optional(),
    /** Separate EDI media password for getMediaContent. */
    SANMAR_MEDIA_PASSWORD: z.string().optional(),
    /** Optional full URL overrides (UAT). Defaults use /pstd/ production paths. */
    SANMAR_INVENTORY_URL: z.string().url().optional(),
    SANMAR_PRICING_URL: z.string().url().optional(),
    SANMAR_MEDIA_URL: z.string().url().optional(),
    SANMAR_BULK_URL: z.string().url().optional(),
  })
  .superRefine((environment, context) => {
    if (environment.ENABLE_DEV_ADMIN_ROUTES && environment.NODE_ENV === "production") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ENABLE_DEV_ADMIN_ROUTES"],
        message: "Development admin routes cannot be enabled in production",
      });
    }
    if (environment.ENABLE_DEV_ADMIN_ROUTES && !environment.DEV_ADMIN_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEV_ADMIN_TOKEN"],
        message: "DEV_ADMIN_TOKEN is required when admin routes are enabled",
      });
    }
    if (
      environment.STRIPE_SECRET_KEY?.startsWith("sk_live_") &&
      environment.NODE_ENV !== "production"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_SECRET_KEY"],
        message:
          "A live Stripe key cannot be used outside production — staging tests would take real money",
      });
    }
    if (
      environment.ADMIN_API_TOKEN &&
      environment.ADMIN_API_TOKEN === environment.COMMERCE_SERVICE_TOKEN
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ADMIN_API_TOKEN"],
        message:
          "ADMIN_API_TOKEN must differ from COMMERCE_SERVICE_TOKEN, or storefront credentials would grant admin access",
      });
    }
  });

export type Environment = z.infer<typeof EnvironmentSchema>;

/** Whether card payment can be offered at all. */
export function stripeEnabled(environment: Environment): boolean {
  return Boolean(environment.STRIPE_SECRET_KEY);
}

/** Whether the admin API is served: development flag, or a production token. */
export function adminRoutesEnabled(environment: Environment): boolean {
  return environment.ENABLE_DEV_ADMIN_ROUTES || Boolean(environment.ADMIN_API_TOKEN);
}

export function loadEnvironment(
  input: NodeJS.ProcessEnv = process.env,
): Environment {
  return EnvironmentSchema.parse(input);
}
