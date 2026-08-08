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
    SANMAR_MAX_PRODUCTS: z.string().optional(),
    SANMAR_SELLABLE_MODE: z.enum(["ACTIVE", "ALL"]).optional(),
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
  });

export type Environment = z.infer<typeof EnvironmentSchema>;

export function loadEnvironment(
  input: NodeJS.ProcessEnv = process.env,
): Environment {
  return EnvironmentSchema.parse(input);
}
