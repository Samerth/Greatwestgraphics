import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { resendConfirmationCode, CognitoAuthError } from "@/lib/auth/cognito";

const BodySchema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const { email } = BodySchema.parse(await request.json());
    await resendConfirmationCode(email);
    return NextResponse.json({ status: "sent" });
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
      { error: { code: "RESEND_FAILED", message: "Could not resend the code." } },
      { status: 500 },
    );
  }
}
