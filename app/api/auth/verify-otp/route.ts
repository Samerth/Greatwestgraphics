import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyEmailOtp, CognitoAuthError } from "@/lib/auth/cognito";
import { completeSignIn } from "@/lib/auth/complete-sign-in";

const BodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  session: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { email, code, session } = BodySchema.parse(await request.json());
    const outcome = await verifyEmailOtp(email, code, session);
    if (outcome.kind !== "authenticated") {
      return NextResponse.json(
        { error: { code: "AUTH_INCOMPLETE", message: "That code didn't work. Try again." } },
        { status: 400 },
      );
    }
    const identity = await completeSignIn(outcome.tokens);
    return NextResponse.json(identity);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Enter the code you received." } },
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
      { error: { code: "OTP_VERIFY_FAILED", message: "Could not verify that code. Please try again." } },
      { status: 500 },
    );
  }
}
