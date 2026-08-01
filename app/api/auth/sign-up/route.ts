import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { signUp, CognitoAuthError } from "@/lib/auth/cognito";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const { email, password, name } = BodySchema.parse(await request.json());
    const result = await signUp(email, password, name);
    return NextResponse.json(result);
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
          code: "SIGN_UP_FAILED",
          message: "Could not create your account. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
