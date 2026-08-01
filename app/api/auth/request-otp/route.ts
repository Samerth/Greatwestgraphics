import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requestEmailOtp, CognitoAuthError } from "@/lib/auth/cognito";

const BodySchema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const { email } = BodySchema.parse(await request.json());
    const challenge = await requestEmailOtp(email);
    return NextResponse.json({ session: challenge.session });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Enter a valid email." } },
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
      { error: { code: "OTP_REQUEST_FAILED", message: "Could not send a code. Please try again." } },
      { status: 500 },
    );
  }
}
