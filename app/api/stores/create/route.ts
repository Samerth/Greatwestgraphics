import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

const BodySchema = z.object({
  accountName: z.string().min(1).max(200),
  storeName: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  accentColor: z.string().max(20).optional(),
  logoUrl: z.string().url().max(2000).optional().or(z.literal("")),
  tagline: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "NOT_SIGNED_IN", message: "Sign in first." } },
      { status: 401 },
    );
  }
  try {
    const body = BodySchema.parse(await request.json());
    const client = await createCommerceClient();
    const result = await client.createAccountWithStore({
      personId: session.personId,
      accountName: body.accountName,
      storeName: body.storeName,
      slug: body.slug,
      accentColor: body.accentColor,
      logoUrl: body.logoUrl || undefined,
      tagline: body.tagline,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues.map((issue) => issue.message).join("; "),
          },
        },
        { status: 400 },
      );
    }
    if (error instanceof CommerceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "STORE_CREATE_FAILED",
          message: "Could not create your store. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
