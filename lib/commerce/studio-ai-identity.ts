/**
 * Experimental identity-mark generator (Pollinations, free, no API key).
 * Not print-ready. Output is a file the shopper can keep, retry, or replace
 * with their own upload.
 */

export const STUDIO_AI_IDENTITY_MODEL = "pollinations";
export const STUDIO_AI_IDENTITY_TIMEOUT_MS = 90_000;
export const STUDIO_AI_IDENTITY_MIN_BYTES = 8_192;
export const STUDIO_AI_IDENTITY_PROMPT_MAX = 280;

const IDENTITY_SUFFIX =
  "flat graphic identity mark for apparel decoration, logo or badge, one to three solid colours, high contrast, clean edges, isolated on pure white background, no photorealism, no mockup, no garment, no people, no extra lettering unless the prompt names it, clipart style";

export function normalizeStudioIdentityPrompt(userPrompt: string): string {
  return userPrompt.replace(/\s+/g, " ").trim();
}

export function buildStudioIdentityPrompt(userPrompt: string): string {
  return `${normalizeStudioIdentityPrompt(userPrompt)}, ${IDENTITY_SUFFIX}`;
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

export async function fetchStudioIdentityBlob(
  userPrompt: string,
  seed: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Blob> {
  const url = studioIdentityImageUrl(userPrompt, seed);
  const res = await fetchImpl(url, {
    signal: AbortSignal.timeout(STUDIO_AI_IDENTITY_TIMEOUT_MS),
    headers: { Accept: "image/*" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Generation failed (${res.status})`);
  }
  const blob = await res.blob();
  if (!isUsableStudioIdentityBlob(blob)) {
    throw new Error("Generator returned an unusable file");
  }
  return blob;
}
