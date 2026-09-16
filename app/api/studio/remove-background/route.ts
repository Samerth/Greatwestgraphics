import { NextResponse } from "next/server";
import {
  StudioAiRefusedError,
  StudioAiUnavailableError,
  removeOpenAiBackground,
  studioAiCanRemoveBackground,
} from "@/lib/commerce/studio-ai-provider";

export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * UAT row 61: "Background remover button for logos."
 *
 * Takes the customer's uploaded logo (multipart `file`), asks the image
 * provider to return it on a transparent background, and hands the PNG
 * bytes back for the studio to swap in. Only offered when the paid provider
 * is configured - the free generator has no such operation - so the studio
 * reads studioAiCanRemoveBackground() before showing the button.
 */
export async function POST(request: Request) {
  if (!studioAiCanRemoveBackground()) {
    return NextResponse.json(
      { error: { code: "AI_UNAVAILABLE", message: "Background removal is not enabled." } },
      { status: 503 },
    );
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Choose a logo file first." } },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "That file is over 10 MB." } },
      { status: 400 },
    );
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Use a PNG, JPG or WEBP." } },
      { status: 400 },
    );
  }

  const filename = file instanceof File && file.name ? file.name : "logo.png";
  try {
    const started = Date.now();
    const image = await removeOpenAiBackground(file, filename);
    console.info(
      "[studio-ai] background removed",
      JSON.stringify({ model: image.model, ms: Date.now() - started, bytes: file.size }),
    );
    return new NextResponse(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": `inline; filename="${filename.replace(/\.[a-z0-9]+$/i, "")}-no-background.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof StudioAiRefusedError) {
      return NextResponse.json(
        { error: { code: error.code, message: "That image can't be processed. Try a different file." } },
        { status: 422 },
      );
    }
    const detail = error instanceof StudioAiUnavailableError ? error.message : String(error);
    console.error("[studio-ai] background removal failed", JSON.stringify({ detail }));
    return NextResponse.json(
      {
        error: {
          code: "AI_UNAVAILABLE",
          message: "Background removal is unavailable right now. Try again in a few minutes.",
        },
      },
      { status: 503 },
    );
  }
}
