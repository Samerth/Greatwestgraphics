import type { DesignSide } from "@gwg/contracts";

/**
 * Experimental identity-mark generator.
 * Primary: FLUX.1-schnell (Hugging Face Space) — stronger image quality
 * and prompt following than the old Pollinations Sana default.
 * Fallback: Pollinations, still free, if Flux is asleep or misses.
 * Not print-ready. Output is a file the shopper can keep, retry, or replace
 * with their own upload.
 */

export const STUDIO_AI_IDENTITY_MODEL = "flux-schnell";
export const STUDIO_AI_IDENTITY_TIMEOUT_MS = 90_000;
export const STUDIO_AI_IDENTITY_MIN_BYTES = 8_192;
export const STUDIO_AI_IDENTITY_PROMPT_MAX = 280;
export const STUDIO_AI_FLUX_SPACE_URL =
  "https://black-forest-labs-flux-1-schnell.hf.space";

const IDENTITY_SUFFIX =
  "flat graphic identity mark for apparel decoration, logo or badge, follow the shopper request exactly for subject colours and lettering, one to three solid colours, high contrast, clean edges, isolated on pure white background, no photorealism, no mockup, no garment, no people, no extra lettering unless the prompt names it, clipart style";

export function normalizeStudioIdentityPrompt(userPrompt: string): string {
  return userPrompt.replace(/\s+/g, " ").trim();
}

export function buildStudioIdentityPrompt(userPrompt: string): string {
  return `${normalizeStudioIdentityPrompt(userPrompt)}, ${IDENTITY_SUFFIX}`;
}

export function studioIdentityFluxSubmitUrl(): string {
  return `${STUDIO_AI_FLUX_SPACE_URL}/gradio_api/call/infer`;
}

export function studioIdentityFluxEventUrl(eventId: string): string {
  return `${STUDIO_AI_FLUX_SPACE_URL}/gradio_api/call/infer/${encodeURIComponent(eventId)}`;
}

export function studioIdentityFluxBody(userPrompt: string, seed: number) {
  return {
    data: [
      buildStudioIdentityPrompt(userPrompt),
      Math.trunc(seed),
      false,
      1024,
      1024,
      4,
    ],
  };
}

export function resolveStudioIdentityFluxFileUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return new URL(trimmed, `${STUDIO_AI_FLUX_SPACE_URL}/`).href;
}

export function parseStudioIdentityFluxImageUrl(sseText: string): string | null {
  let found: string | null = null;
  const walk = (value: unknown) => {
    if (found) return;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (
        /^https?:\/\//i.test(trimmed) ||
        trimmed.startsWith("/gradio_api/file") ||
        trimmed.startsWith("/file=")
      ) {
        found = resolveStudioIdentityFluxFileUrl(trimmed);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.url === "string") {
        found = resolveStudioIdentityFluxFileUrl(record.url);
        return;
      }
      for (const item of Object.values(record)) walk(item);
    }
  };

  for (const line of sseText.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "null" || payload === "[DONE]") continue;
    try {
      walk(JSON.parse(payload));
    } catch {
      // Ignore non-JSON SSE comments.
    }
  }
  return found;
}

export function studioIdentityImageUrl(
  userPrompt: string,
  seed: number,
): string {
  const prompt = buildStudioIdentityPrompt(userPrompt);
  const params = new URLSearchParams({
    width: "1024",
    height: "1024",
    seed: String(Math.trunc(seed)),
    nologo: "true",
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

export function nextStudioIdentitySeed(random = Math.random): number {
  return Math.floor(random() * 1_000_000_000);
}

export function isUsableStudioIdentityBlob(blob: Blob): boolean {
  if (blob.size < STUDIO_AI_IDENTITY_MIN_BYTES) return false;
  const type = blob.type.toLowerCase();
  if (!type || type === "application/octet-stream") return true;
  return type.startsWith("image/");
}

export function studioIdentityExtension(mime = "image/png"): string {
  const type = mime.toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

/** Full plate so the try-out is readable on the garment, not a 5×5 speck. */
export function studioIdentityPlacementZone(side: DesignSide): string {
  if (side === "back") return "Full Back";
  if (side === "left") return "Left Side Panel";
  if (side === "right") return "Right Side Panel";
  return "Full Front";
}

export function studioIdentityFilename(
  userPrompt: string,
  mime = "image/png",
): string {
  const slug = normalizeStudioIdentityPrompt(userPrompt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const ext = studioIdentityExtension(mime);
  return slug ? `identity-${slug}.${ext}` : `identity-mark.${ext}`;
}

async function readBlob(
  res: Response,
  failedMessage: string,
): Promise<Blob> {
  if (!res.ok) {
    throw new Error(`${failedMessage} (${res.status})`);
  }
  const blob = await res.blob();
  if (!isUsableStudioIdentityBlob(blob)) {
    throw new Error("Generator returned an unusable file");
  }
  return blob;
}

async function fetchFluxIdentityBlob(
  userPrompt: string,
  seed: number,
  fetchImpl: typeof fetch,
): Promise<Blob> {
  const submit = await fetchImpl(studioIdentityFluxSubmitUrl(), {
    method: "POST",
    signal: AbortSignal.timeout(STUDIO_AI_IDENTITY_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(studioIdentityFluxBody(userPrompt, seed)),
    cache: "no-store",
  });
  if (!submit.ok) {
    throw new Error(`Generation failed (${submit.status})`);
  }
  const submitted = (await submit.json()) as { event_id?: unknown };
  const eventId =
    typeof submitted.event_id === "string" ? submitted.event_id.trim() : "";
  if (!eventId) {
    throw new Error("Generator returned no event");
  }

  const event = await fetchImpl(studioIdentityFluxEventUrl(eventId), {
    signal: AbortSignal.timeout(STUDIO_AI_IDENTITY_TIMEOUT_MS),
    headers: { Accept: "text/event-stream" },
    cache: "no-store",
  });
  if (!event.ok) {
    throw new Error(`Generation failed (${event.status})`);
  }
  const imageUrl = parseStudioIdentityFluxImageUrl(await event.text());
  if (!imageUrl) {
    throw new Error("Generator returned no image");
  }

  return readBlob(
    await fetchImpl(imageUrl, {
      signal: AbortSignal.timeout(STUDIO_AI_IDENTITY_TIMEOUT_MS),
      headers: { Accept: "image/*" },
      cache: "no-store",
    }),
    "Generation failed",
  );
}

async function fetchPollinationsIdentityBlob(
  userPrompt: string,
  seed: number,
  fetchImpl: typeof fetch,
): Promise<Blob> {
  return readBlob(
    await fetchImpl(studioIdentityImageUrl(userPrompt, seed), {
      signal: AbortSignal.timeout(STUDIO_AI_IDENTITY_TIMEOUT_MS),
      headers: { Accept: "image/*" },
      cache: "no-store",
    }),
    "Generation failed",
  );
}

export async function fetchStudioIdentityBlob(
  userPrompt: string,
  seed: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Blob> {
  try {
    return await fetchFluxIdentityBlob(userPrompt, seed, fetchImpl);
  } catch {
    return fetchPollinationsIdentityBlob(userPrompt, seed, fetchImpl);
  }
}
