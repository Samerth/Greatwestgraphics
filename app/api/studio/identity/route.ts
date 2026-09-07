import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  STUDIO_AI_IDENTITY_PROMPT_MAX,
  fetchStudioIdentityBlob,
  nextStudioIdentitySeed,
  normalizeStudioIdentityPrompt,
  studioIdentityFilename,
} from "@/lib/commerce/studio-ai-identity";

export const maxDuration = 120;

const BodySchema = z.object({
  prompt: z.string().min(2).max(STUDIO_AI_IDENTITY_PROMPT_MAX),
  seed: z.number().int().nonnegative().optional(),
});

/**
 * Experimental Pollinations proxy. The browser never talks to the generator
 * directly, so CORS and a long GET prompt URL are not the shopper's problem.
 * The file comes back as bytes they can keep on the garment (and later
 * upload) — not a hotlink.
 */
export async function POST(request: Request) {
  try {
    const { prompt: rawPrompt, seed: requestedSeed } = BodySchema.parse(
      await request.json(),
    );
    const prompt = normalizeStudioIdentityPrompt(rawPrompt);
    if (prompt.length < 2) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Describe the mark in a few words.",
          },
        },
        { status: 400 },
      );
    }

    const firstSeed = requestedSeed ?? nextStudioIdentitySeed();
    let blob: Blob;
    try {
      blob = await fetchStudioIdentityBlob(prompt, firstSeed);
    } catch {
      blob = await fetchStudioIdentityBlob(prompt, nextStudioIdentitySeed());
    }

    const type = blob.type || "image/png";
    return new NextResponse(await blob.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${studioIdentityFilename(prompt, type)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Describe a logo or badge in a short prompt.",
          },
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "IDENTITY_MISSED",
          message:
            "The free generator missed or timed out. Try again, or upload your own art.",
        },
      },
      { status: 502 },
    );
  }
}
