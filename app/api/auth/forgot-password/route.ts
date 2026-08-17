import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { startPasswordReset, CognitoAuthError } from "@/lib/auth/cognito";

const BodySchema = z.object({ email: z.string().email() });

/**
 * Requests a password-reset code.
 *
 * Answers the same way whether or not the address has an account. Reporting
 * "no such user" here would let anyone enumerate the customer list one email
 * at a time, and the caller has nothing useful to do with the distinction: the
 * next screen asks for the code either way.
 */
export async function POST(request: Request) {
  let email: string;
  try {
    email = BodySchema.parse(await request.json()).email;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Enter a valid email address.",
          },
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "RESET_FAILED", message: "Could not start a reset." } },
      { status: 500 },
    );
  }

  try {
    await startPasswordReset(email);
  } catch (error) {
    // Rate limiting is worth surfacing — the user can act on it, and it says
    // nothing about whether the account exists.
    if (error instanceof CognitoAuthError && error.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 429 },
      );
    }
  }

  return NextResponse.json({ status: "code_sent" });
}
