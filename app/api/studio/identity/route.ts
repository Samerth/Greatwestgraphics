import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCustomerSession } from "@/lib/auth/session";
import { getGuestId } from "@/lib/auth/guest-identity";
import {
  STUDIO_AI_PURPOSE_MAX,
  STUDIO_AI_SUBJECTS_MAX,
  STUDIO_AI_STYLES,
  buildStudioAiArtPrompt,
  fetchStudioIdentityBlob,
  nextStudioIdentitySeed,
  studioIdentityFilename,
} from "@/lib/commerce/studio-ai-identity";
import {
  StudioAiRateLimiter,
  StudioAiRefusedError,
  StudioAiUnavailableError,
  generateOpenAiImage,
  studioAiLimits,
  studioAiProvider,
} from "@/lib/commerce/studio-ai-provider";
import {
  StudioAiGuardError,
  assertStudioAiPromptAllowed,
} from "@/lib/commerce/studio-ai-guard";

// One brake per running process - see StudioAiRateLimiter for why that is
// enough here. Only the paid provider is metered; the free one has no bill.
const limits = studioAiLimits();
const limiter = new StudioAiRateLimiter(limits.perHour, limits.perDay);

async function callerIdentity(): Promise<string> {
  const session = await getCustomerSession().catch(() => null);
  if (session?.personId) return `person:${session.personId}`;
  const guest = await getGuestId().catch(() => null);
  return guest ? `guest:${guest}` : "anonymous";
}

export const maxDuration = 120;

const STYLE_IDS = STUDIO_AI_STYLES.map((s) => s.id) as [string, ...string[]];

const BodySchema = z.object({
  purpose: z.string().min(2).max(STUDIO_AI_PURPOSE_MAX),
  subjects: z.string().max(STUDIO_AI_SUBJECTS_MAX).optional().default(""),
  styleId: z.enum(STYLE_IDS),
  seed: z.number().int().nonnegative().optional(),
});

/**
 * AI Art panel proxy. The browser never talks to the generator directly,
 * and never builds the raw prompt itself — it sends the shopper's structured
 * answers, and this route is the one place that turns them into what the
 * *current* generator wants (see buildStudioAiArtPrompt). The file comes
 * back as bytes they can keep on the garment (and later upload) — not a
 * hotlink.
 *
 * Which generator is decided by studioAiProvider(): the free FLUX Space by
 * default, OpenAI on Great West Graphics' own key once STUDIO_AI_PROVIDER
 * and OPENAI_API_KEY are set. A paid refusal or outage is reported with its
 * own code so the panel can say the right thing.
 */
export async function POST(request: Request) {
  const provider = studioAiProvider();
  try {
    const body = BodySchema.parse(await request.json());
    // Before the prompt is even built, let alone paid for: every image model
    // drew a Nike swoosh on request (16 Sep), and that print would be ours.
    assertStudioAiPromptAllowed({ purpose: body.purpose, subjects: body.subjects });
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

    if (provider === "openai") {
      const identity = await callerIdentity();
      const gate = limiter.take(identity);
      if (!gate.ok) {
        return NextResponse.json(
          {
            error: {
              code: "AI_RATE_LIMITED",
              message:
                gate.reason === "identity"
                  ? "That's a lot of designs in one hour - take a break and try again shortly, or upload your own art."
                  : "The AI designer is resting for today. Upload your own art, or try again tomorrow.",
            },
          },
          { status: 429 },
        );
      }
      const started = Date.now();
      const image = await generateOpenAiImage(prompt);
      console.info(
        "[studio-ai] generated",
        JSON.stringify({ provider, model: image.model, ms: Date.now() - started, identity }),
      );
      return new NextResponse(new Uint8Array(image.bytes), {
        status: 200,
        headers: {
          "Content-Type": image.contentType,
          "Content-Disposition": `inline; filename="${studioIdentityFilename(prompt, image.contentType)}"`,
          "Cache-Control": "no-store",
          "X-Studio-Ai-Provider": provider,
        },
      });
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
        "X-Studio-Ai-Provider": provider,
      },
    });
  } catch (error) {
    if (error instanceof StudioAiGuardError) {
      console.info("[studio-ai] guarded", JSON.stringify({ provider }));
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 },
      );
    }
    if (error instanceof StudioAiRefusedError) {
      console.info("[studio-ai] refused", JSON.stringify({ provider }));
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 },
      );
    }
    if (error instanceof StudioAiUnavailableError) {
      console.error("[studio-ai] unavailable", JSON.stringify({ provider, status: error.status, message: error.message }));
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: "The AI designer is unavailable right now. Try again in a few minutes, or upload your own art.",
          },
        },
        { status: 503 },
      );
    }
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
