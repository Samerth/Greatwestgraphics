import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { signInWithPassword, CognitoAuthError } from "@/lib/auth/cognito";
import { completeSignIn } from "@/lib/auth/complete-sign-in";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { email, password } = BodySchema.parse(await request.json());
    const outcome = await signInWithPassword(email, password);
    if (outcome.kind !== "authenticated") {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_INCOMPLETE",
            message: "Sign-in did not complete. Try again.",
          },
        },
        { status: 400 },
      );
    }
    const identity = await completeSignIn(outcome.tokens);
    return NextResponse.json(identity);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Enter a valid email and password." } },
        { status: 400 },
      );
    }
    if (error instanceof CognitoAuthError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: "SIGN_IN_FAILED", message: "Could not sign you in. Please try again." } },
      { status: 500 },
    );
  }
}
