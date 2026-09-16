/**
 * Which service draws for the Design Studio's AI Art panel, and how.
 *
 * The panel and the prompt builder never know which generator is behind
 * them (see studio-ai-identity.ts). This module is the one place that does:
 * it picks the provider from the environment, speaks its API, and turns its
 * failures into the three things the studio can act on - a refusal the
 * customer should rephrase, a service that is unavailable, and everything
 * else.
 *
 * Providers:
 *   "flux"   - the free FLUX Space with the Pollinations fallback. No key,
 *              no moderation contract, not print-ready. The default when no
 *              paid key is configured, so the studio keeps working.
 *   "openai" - OpenAI's image models on Great West Graphics' own key. Chosen
 *              so one account can serve both this panel and CodChat (16 Sep
 *              plan). Transparent PNG output, documented moderation refusals,
 *              and an edits endpoint that strips a background from an
 *              uploaded logo (UAT row 61).
 *
 * The key never reaches the browser: everything here runs in the API routes.
 */

export type StudioAiProvider = "flux" | "openai";

export const OPENAI_IMAGES_BASE = "https://api.openai.com/v1";
/**
 * Overridable per deployment so a newer model is a config change.
 *
 * Chosen 16 Sep after probing gpt-image-1, gpt-image-2 and gpt-image-2.5-flare
 * with the same 16 prompts (scripts/probe-openai-images.mjs): flare drew the
 * flattest, most screen-printable marks with correct lettering, refused the
 * gore prompt that gpt-image-2 drew, and costs ~28% less per image than
 * gpt-image-1. Every model drew a Nike swoosh on request - hence the guard in
 * studio-ai-guard.ts.
 */
export const OPENAI_IMAGE_MODEL_DEFAULT = "gpt-image-2.5-flare";
export const OPENAI_IMAGE_SIZE = "1024x1024";
/** "medium" is the tier the cost model was built on (~5c per image). */
export const OPENAI_IMAGE_QUALITY_DEFAULT = "medium";

type Env = Record<string, string | undefined>;

/**
 * "openai" only when it is asked for AND a key is present. A deployment that
 * flips the flag without the key falls back to the free generator rather
 * than failing every generation - the panel is a try-out, not a gate.
 */
export function studioAiProvider(env: Env = process.env): StudioAiProvider {
  const wanted = (env.STUDIO_AI_PROVIDER ?? "").trim().toLowerCase();
  if (wanted === "openai" && (env.OPENAI_API_KEY ?? "").trim()) return "openai";
  return "flux";
}

/** Whether the row 61 background-remover can be offered. */
export function studioAiCanRemoveBackground(env: Env = process.env): boolean {
  return studioAiProvider(env) === "openai";
}

export function openAiImageModel(env: Env = process.env): string {
  return (env.OPENAI_IMAGE_MODEL ?? "").trim() || OPENAI_IMAGE_MODEL_DEFAULT;
}

export function openAiImageQuality(env: Env = process.env): "low" | "medium" | "high" {
  const wanted = (env.OPENAI_IMAGE_QUALITY ?? "").trim().toLowerCase();
  return wanted === "low" || wanted === "high" ? wanted : OPENAI_IMAGE_QUALITY_DEFAULT;
}

/** The customer asked for something the provider will not draw. Shown to
 * them as a reason to rephrase, never as a fault. */
export class StudioAiRefusedError extends Error {
  readonly code = "AI_REFUSED";
}

/** Key missing or rejected, quota exhausted, provider down. The customer sees
 * "unavailable"; the operator sees the detail in the log. */
export class StudioAiUnavailableError extends Error {
  readonly code = "AI_UNAVAILABLE";
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
  }
}

/**
 * What the studio needs from OpenAI on top of the panel's own prompt. The
 * FLUX suffix asks for the same qualities in that model's dialect; this one
 * is plain English because that is what gpt-image follows best. Transparent
 * background is requested in the API call as well as here - the parameter is
 * what guarantees the alpha channel, the words keep the drawing from painting
 * a backdrop that then gets cut out badly.
 */
export const OPENAI_IDENTITY_SUFFIX =
  "Flat vector-style logo mark for printing on apparel. Solid colours only, " +
  "no gradients, no photo textures, no shading; at most three colours; clean " +
  "closed shapes with crisp edges; centred with margin around it; transparent " +
  "background; no mockup, no garment, no frame, no watermark, no extra text.";

export function buildOpenAiImagePrompt(panelPrompt: string): string {
  return `${panelPrompt.trim()}. ${OPENAI_IDENTITY_SUFFIX}`;
}

export type OpenAiImageRequestBody = {
  model: string;
  prompt: string;
  n: 1;
  size: string;
  quality: "low" | "medium" | "high";
  background: "transparent";
  output_format: "png";
  /** "auto" is OpenAI's default filter. Kept explicit so it is a visible
   * decision rather than an inherited default. */
  moderation: "auto";
};

export function buildOpenAiImageRequest(
  panelPrompt: string,
  env: Env = process.env,
): OpenAiImageRequestBody {
  return {
    model: openAiImageModel(env),
    prompt: buildOpenAiImagePrompt(panelPrompt),
    n: 1,
    size: OPENAI_IMAGE_SIZE,
    quality: openAiImageQuality(env),
    background: "transparent",
    output_format: "png",
    moderation: "auto",
  };
}

type OpenAiErrorBody = {
  error?: { code?: string | null; type?: string | null; message?: string | null };
};

/**
 * OpenAI's images endpoints answer a refused prompt with HTTP 400 and an
 * error code of `moderation_blocked` (older models phrase the same thing as
 * a `content_policy_violation` or a safety message). Anything else that is
 * not a 2xx is the service's problem, not the customer's.
 */
export function classifyOpenAiFailure(
  status: number,
  body: unknown,
): StudioAiRefusedError | StudioAiUnavailableError {
  const error = (body as OpenAiErrorBody | null)?.error ?? {};
  const code = String(error.code ?? "").toLowerCase();
  const type = String(error.type ?? "").toLowerCase();
  const message = String(error.message ?? "");
  const refused =
    status === 400 &&
    (code.includes("moderation") ||
      code.includes("content_policy") ||
      type.includes("content_policy") ||
      /safety|content policy|not allowed|violat/i.test(message));
  if (refused) {
    return new StudioAiRefusedError(
      "We can't draw that one. Try describing the mark differently - what it is for, and what should be in it.",
    );
  }
  if (status === 401 || status === 403) {
    return new StudioAiUnavailableError(`OpenAI rejected the key (${status})`, status);
  }
  if (status === 429) {
    return new StudioAiUnavailableError("OpenAI rate limit or quota reached (429)", status);
  }
  return new StudioAiUnavailableError(
    `OpenAI images failed (${status})${message ? `: ${message.slice(0, 200)}` : ""}`,
    status,
  );
}

function decodeBase64Png(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/**
 * One generation. Returns PNG bytes with an alpha channel. The 60 s ceiling
 * is well above a normal 10-20 s draw and well below the route's own limit.
 */
export async function generateOpenAiImage(
  panelPrompt: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array; contentType: "image/png"; model: string }> {
  const key = (env.OPENAI_API_KEY ?? "").trim();
  if (!key) throw new StudioAiUnavailableError("OPENAI_API_KEY is not set");
  const body = buildOpenAiImageRequest(panelPrompt, env);
  const response = await fetchImpl(`${OPENAI_IMAGES_BASE}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw classifyOpenAiFailure(response.status, payload);
  const b64 = (payload as { data?: { b64_json?: string }[] } | null)?.data?.[0]?.b64_json;
  if (!b64) throw new StudioAiUnavailableError("OpenAI returned no image data");
  return { bytes: decodeBase64Png(b64), contentType: "image/png", model: body.model };
}

/** What the background remover asks for. The artwork must survive intact;
 * only the backdrop goes. */
export const OPENAI_REMOVE_BACKGROUND_PROMPT =
  "Remove the background completely and output the artwork on a fully " +
  "transparent background. Keep every part of the logo or artwork exactly as " +
  "it is - same shapes, same colours, same proportions, same text. Do not " +
  "redraw, restyle, crop or add anything.";

/**
 * UAT row 61: strip a flat background from an uploaded logo. Uses the edits
 * endpoint with the customer's file as the image and a transparent output,
 * which is the one operation gpt-image offers that Recraft's dedicated
 * remover would have covered.
 */
export async function removeOpenAiBackground(
  file: Blob,
  filename: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array; contentType: "image/png"; model: string }> {
  const key = (env.OPENAI_API_KEY ?? "").trim();
  if (!key) throw new StudioAiUnavailableError("OPENAI_API_KEY is not set");
  const model = openAiImageModel(env);
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", OPENAI_REMOVE_BACKGROUND_PROMPT);
  form.append("image", file, filename);
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("size", OPENAI_IMAGE_SIZE);
  form.append("quality", openAiImageQuality(env));
  const response = await fetchImpl(`${OPENAI_IMAGES_BASE}/images/edits`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw classifyOpenAiFailure(response.status, payload);
  const b64 = (payload as { data?: { b64_json?: string }[] } | null)?.data?.[0]?.b64_json;
  if (!b64) throw new StudioAiUnavailableError("OpenAI returned no image data");
  return { bytes: decodeBase64Png(b64), contentType: "image/png", model };
}

/**
 * A small brake in front of a paid service. OpenAI's project budget is the
 * hard stop; this keeps one visitor from running through it in an afternoon.
 * In-memory on purpose: the web tier runs as one task per environment, and
 * the cost of being wrong here is a few dollars, not data loss.
 */
export class StudioAiRateLimiter {
  private readonly stamps = new Map<string, number[]>();

  constructor(
    private readonly perIdentityPerHour: number,
    private readonly perDayTotal: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** True when the request may proceed; records it if so. */
  take(identity: string): { ok: true } | { ok: false; reason: "identity" | "daily" } {
    const t = this.now();
    const hourAgo = t - 60 * 60 * 1000;
    const dayAgo = t - 24 * 60 * 60 * 1000;
    let dayTotal = 0;
    for (const [key, list] of this.stamps) {
      const kept = list.filter((stamp) => stamp > dayAgo);
      if (kept.length) this.stamps.set(key, kept);
      else this.stamps.delete(key);
      dayTotal += kept.length;
    }
    if (dayTotal >= this.perDayTotal) return { ok: false, reason: "daily" };
    const mine = (this.stamps.get(identity) ?? []).filter((stamp) => stamp > hourAgo);
    if (mine.length >= this.perIdentityPerHour) return { ok: false, reason: "identity" };
    this.stamps.set(identity, [...(this.stamps.get(identity) ?? []), t]);
    return { ok: true };
  }
}

export function studioAiLimits(env: Env = process.env): { perHour: number; perDay: number } {
  const perHour = Number(env.STUDIO_AI_PER_HOUR ?? 30);
  const perDay = Number(env.STUDIO_AI_PER_DAY ?? 500);
  return {
    perHour: Number.isFinite(perHour) && perHour > 0 ? perHour : 30,
    perDay: Number.isFinite(perDay) && perDay > 0 ? perDay : 500,
  };
}
