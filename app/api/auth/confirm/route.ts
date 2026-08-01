import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { confirmSignUp, signInWithPassword, CognitoAuthError } from "@/lib/auth/cognito";
import { completeSignIn } from "@/lib/auth/complete-sign-in";

const BodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  // Only needed if the caller wants to sign the user in immediately after
  // confirming, since Cognito requires a fresh sign-in after confirmation.
  password: z.string().min(8).optional(),
});

export async function POST(request: Request) {
  try {
    const { email, code, password } = BodySchema.parse(await request.json());
    await confirmSignUp(email, code);

    if (password) {
      const outcome = await signInWithPassword(email, password);
      if (outcome.kind === "authenticated") {
        const identity = await completeSignIn(outcome.tokens);
        return NextResponse.json({ status: "confirmed", signedIn: true, ...identity });
      }
    }
    return NextResponse.json({ status: "confirmed", signedIn: false });
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
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "CONFIRM_FAILED",
          message: "Could not confirm your account. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
