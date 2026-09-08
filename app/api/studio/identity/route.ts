import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  STUDIO_AI_PURPOSE_MAX,
  STUDIO_AI_SUBJECTS_MAX,
  STUDIO_AI_STYLES,
  buildStudioAiArtPrompt,
  fetchStudioIdentityBlob,
  nextStudioIdentitySeed,
  studioIdentityFilename,
} from "@/lib/commerce/studio-ai-identity";

export const maxDuration = 120;

const STYLE_IDS = STUDIO_AI_STYLES.map((s) => s.id) as [string, ...string[]];

const BodySchema = z.object({
  purpose: z.string().min(2).max(STUDIO_AI_PURPOSE_MAX),
  subjects: z.string().max(STUDIO_AI_SUBJECTS_MAX).optional().default(""),
  styleId: z.enum(STYLE_IDS),
  seed: z.number().int().nonnegative().optional(),
});

/**
 * AI Art panel proxy (FLUX.1-schnell, Pollinations fallback). The browser
 * never talks to the generator directly, and never builds the raw prompt
 * itself — it sends the shopper's structured answers, and this route is the
 * one place that turns them into what the *current* generator wants
 * (see buildStudioAiArtPrompt). The file comes back as bytes they can keep
 * on the garment (and later upload) — not a hotlink.
 */
export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const prompt = buildStudioAiArtPrompt({
      purpose: body.purpose,
      subjects: body.subjects,
      styleId: body.styleId as (typeof STUDIO_AI_STYLES)[number]["id"],
    });
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

    const firstSeed = body.seed ?? nextStudioIdentitySeed();
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
