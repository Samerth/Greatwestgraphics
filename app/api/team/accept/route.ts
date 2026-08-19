import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";
import {
  isStoreSlug,
  STORE_COOKIE,
  storeCookieOptions,
} from "@/lib/commerce/store-cookie";

const BodySchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "NOT_SIGNED_IN", message: "Sign in first." } },
      { status: 401 },
    );
  }
  try {
    const { token } = BodySchema.parse(await request.json());
    const client = await createCommerceClient();
    const result = await client.acceptAccountInvite(token, session.personId, session.email);
    const response = NextResponse.json(result);
    if (result.storeSlug && isStoreSlug(result.storeSlug)) {
      response.cookies.set(STORE_COOKIE, result.storeSlug, storeCookieOptions());
    }
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid invite." } },
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
      { error: { code: "ACCEPT_FAILED", message: "Could not accept the invite." } },
      { status: 500 },
    );
  }
}
