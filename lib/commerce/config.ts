import { z } from "zod";

const CommerceWebEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    COMMERCE_API_BASE_URL: z.string().url(),
    COMMERCE_DEV_TENANT_ID: z.string().uuid(),
    COMMERCE_DEV_ACCOUNT_ID: z.string().uuid(),
    COMMERCE_DEV_STORE_ID: z.string().uuid(),
    COMMERCE_DEV_CUSTOMER_PERSON_ID: z.string().uuid(),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === "production") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Development commerce identity cannot be used in production",
      });
    }
  });

export type CommerceWebEnvironment = z.infer<
  typeof CommerceWebEnvironmentSchema
>;

export function loadCommerceWebEnvironment(
  input: NodeJS.ProcessEnv = process.env,
): CommerceWebEnvironment {
  return CommerceWebEnvironmentSchema.parse(input);
}
