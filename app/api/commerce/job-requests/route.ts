import { StorefrontJobSubmissionSchema } from "@gwg/contracts";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";

export async function POST(request: Request) {
  try {
    const submission = StorefrontJobSubmissionSchema.parse(await request.json());
    const jobRequest = await createCommerceClient().submitJobRequest(submission);
    return NextResponse.json(jobRequest, { status: 201 });
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
          code: "COMMERCE_CONFIGURATION_ERROR",
          message:
            "The review service is not configured. Check the local commerce environment settings and retry.",
        },
      },
      { status: 503 },
    );
  }
}
