import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  completePasswordReset,
  signInWithPassword,
  CognitoAuthError,
} from "@/lib/auth/cognito";
import { completeSignIn } from "@/lib/auth/complete-sign-in";

const BodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  password: z.string().min(8),
});

/**
 * Completes a password reset and signs the customer straight in, so a reset
 * does not dead-end on a second login form with the password they just chose.
 */
export async function POST(request: Request) {
  try {
    const { email, code, password } = BodySchema.parse(await request.json());
    await completePasswordReset(email, code, password);

    const outcome = await signInWithPassword(email, password);
    if (outcome.kind === "authenticated") {
      const identity = await completeSignIn(outcome.tokens);
      return NextResponse.json({ status: "reset", signedIn: true, ...identity });
    }
    return NextResponse.json({ status: "reset", signedIn: false });
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
    if (error instanceof CognitoAuthError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "RATE_LIMITED" ? 429 : 400 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "RESET_FAILED",
          message: "Could not reset your password. Request a new code.",
        },
      },
      { status: 500 },
    );
  }
}
