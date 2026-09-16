import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  OPENAI_IDENTITY_SUFFIX,
  StudioAiRateLimiter,
  StudioAiRefusedError,
  StudioAiUnavailableError,
  buildOpenAiImageRequest,
  classifyOpenAiFailure,
  generateOpenAiImage,
  removeOpenAiBackground,
  studioAiCanRemoveBackground,
  studioAiLimits,
  studioAiProvider,
} from "./studio-ai-provider";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The OpenAI route for the AI Art panel, built ahead of the key (16 Sep) so
 * switching it on is configuration. Nothing here calls OpenAI: fetch is
 * captured, and the refusal contract is what the docs describe.
 */
describe("which generator draws", () => {
  it("is the free generator unless OpenAI is asked for AND a key exists", () => {
    expect(studioAiProvider({})).toBe("flux");
    expect(studioAiProvider({ STUDIO_AI_PROVIDER: "openai" })).toBe("flux");
    expect(studioAiProvider({ OPENAI_API_KEY: "sk-test" })).toBe("flux");
    expect(studioAiProvider({ STUDIO_AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" })).toBe("openai");
    expect(studioAiProvider({ STUDIO_AI_PROVIDER: "OpenAI ", OPENAI_API_KEY: " sk-test " })).toBe("openai");
  });

  it("offers the background remover only on the paid provider", () => {
    expect(studioAiCanRemoveBackground({})).toBe(false);
    expect(studioAiCanRemoveBackground({ STUDIO_AI_PROVIDER: "openai", OPENAI_API_KEY: "sk" })).toBe(true);
  });
});

describe("the request OpenAI receives", () => {
  it("asks for a transparent PNG logo at the costed quality", () => {
    const body = buildOpenAiImageRequest("Bold badge for Riverside FC", {});
    expect(body.background).toBe("transparent");
    expect(body.output_format).toBe("png");
    expect(body.quality).toBe("medium");
    expect(body.size).toBe("1024x1024");
    expect(body.n).toBe(1);
    expect(body.prompt.startsWith("Bold badge for Riverside FC.")).toBe(true);
    expect(body.prompt).toContain(OPENAI_IDENTITY_SUFFIX);
  });

  it("lets the model and quality be a deployment setting", () => {
    const body = buildOpenAiImageRequest("x", {
      OPENAI_IMAGE_MODEL: "gpt-image-2",
      OPENAI_IMAGE_QUALITY: "low",
    });
    expect(body.model).toBe("gpt-image-2");
    expect(body.quality).toBe("low");
    expect(buildOpenAiImageRequest("x", { OPENAI_IMAGE_QUALITY: "ultra" }).quality).toBe("medium");
  });

  it("keeps the print-shop constraints in the suffix", () => {
    for (const phrase of ["Solid colours only", "transparent background", "no mockup", "no watermark"]) {
      expect(OPENAI_IDENTITY_SUFFIX).toContain(phrase);
    }
  });
});

describe("what a failure means", () => {
  it("treats OpenAI's moderation block as the customer's prompt, not an outage", () => {
    const error = classifyOpenAiFailure(400, {
      error: { code: "moderation_blocked", type: "image_generation_user_error", message: "Your request was rejected by the safety system." },
    });
    expect(error).toBeInstanceOf(StudioAiRefusedError);
    expect(error.message).toMatch(/can't draw that/i);
  });

  it("recognises the older content-policy phrasing too", () => {
    expect(
      classifyOpenAiFailure(400, { error: { code: "content_policy_violation", message: "" } }),
    ).toBeInstanceOf(StudioAiRefusedError);
    expect(
      classifyOpenAiFailure(400, { error: { code: null, message: "This request violates our content policy." } }),
    ).toBeInstanceOf(StudioAiRefusedError);
  });

  it("treats a bad key, a quota and a server fault as unavailable", () => {
    for (const status of [401, 403, 429, 500, 502]) {
      const error = classifyOpenAiFailure(status, { error: { message: "x" } });
      expect(error, String(status)).toBeInstanceOf(StudioAiUnavailableError);
      expect((error as StudioAiUnavailableError).status).toBe(status);
    }
  });

  it("does not mistake an ordinary 400 for a refusal", () => {
    expect(
      classifyOpenAiFailure(400, { error: { code: "invalid_request_error", message: "size must be one of ..." } }),
    ).toBeInstanceOf(StudioAiUnavailableError);
  });
});

describe("generating", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

  it("sends the bearer key and returns the decoded PNG", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ data: [{ b64_json: png }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await generateOpenAiImage("Bakery mark", { OPENAI_API_KEY: "sk-test" }, fetchImpl);
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/images/generations");
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe("Bearer sk-test");
    expect(Array.from(result.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(result.contentType).toBe("image/png");
  });

  it("refuses to run without a key rather than calling out unauthenticated", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(generateOpenAiImage("x", {}, fetchImpl)).rejects.toBeInstanceOf(StudioAiUnavailableError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces a refusal from the live response", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "moderation_blocked", message: "rejected" } }), { status: 400 }),
    ) as unknown as typeof fetch;
    await expect(generateOpenAiImage("x", { OPENAI_API_KEY: "sk" }, fetchImpl)).rejects.toBeInstanceOf(StudioAiRefusedError);
  });

  it("removes a background through the edits endpoint as multipart", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ data: [{ b64_json: png }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    await removeOpenAiBackground(file, "logo.png", { OPENAI_API_KEY: "sk" }, fetchImpl);
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/images/edits");
    const form = calls[0]!.init.body as FormData;
    expect(form.get("background")).toBe("transparent");
    expect(form.get("output_format")).toBe("png");
    expect(String(form.get("prompt"))).toMatch(/Remove the background completely/);
    expect(form.get("image")).toBeInstanceOf(Blob);
  });
});

describe("the brake in front of the paid service", () => {
  it("caps one visitor per hour and everyone per day", () => {
    let t = 0;
    const limiter = new StudioAiRateLimiter(2, 3, () => t);
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a")).toEqual({ ok: false, reason: "identity" });
    expect(limiter.take("b").ok).toBe(true);
    expect(limiter.take("c")).toEqual({ ok: false, reason: "daily" });
    // An hour later the visitor's own cap has cleared, the day's has not.
    t = 61 * 60 * 1000;
    expect(limiter.take("a")).toEqual({ ok: false, reason: "daily" });
    // A day later everything has cleared.
    t = 25 * 60 * 60 * 1000;
    expect(limiter.take("a").ok).toBe(true);
  });

  it("reads its limits from the environment with sane defaults", () => {
    expect(studioAiLimits({})).toEqual({ perHour: 30, perDay: 500 });
    expect(studioAiLimits({ STUDIO_AI_PER_HOUR: "5", STUDIO_AI_PER_DAY: "50" })).toEqual({ perHour: 5, perDay: 50 });
    expect(studioAiLimits({ STUDIO_AI_PER_HOUR: "nope", STUDIO_AI_PER_DAY: "-1" })).toEqual({ perHour: 30, perDay: 500 });
  });
});

describe("the studio is wired for it", () => {
  const route = stripComments(read("app/api/studio/identity/route.ts"));
  const remover = stripComments(read("app/api/studio/remove-background/route.ts"));
  const studio = stripComments(read("components/design/DesignStudio.tsx"));
  const editor = stripComments(read("components/design/StudioElementEditor.tsx"));
  const page = stripComments(read("app/(shop)/design/page.tsx"));

  it("branches the identity route on the provider and meters only the paid one", () => {
    expect(route).toContain('if (provider === "openai")');
    expect(route).toContain("limiter.take(identity)");
    expect(route).toContain("generateOpenAiImage(prompt)");
    // Refusal and outage get their own codes so the panel can explain.
    expect(route).toMatch(/StudioAiRefusedError[\s\S]{0,200}status: 422/);
    expect(route).toMatch(/StudioAiUnavailableError[\s\S]{0,400}status: 503/);
  });

  it("keeps the free generator as the fallback path", () => {
    expect(route).toContain("fetchStudioIdentityBlob(prompt, firstSeed)");
  });

  it("only exposes the background remover when the provider allows it", () => {
    expect(remover).toContain("if (!studioAiCanRemoveBackground())");
    expect(page).toContain("aiBackgroundRemoval={studioAiCanRemoveBackground()}");
    expect(studio).toMatch(/aiBackgroundRemoval && selectedArtwork && !isStaff/);
    expect(editor).toContain("{onRemoveBackground && (");
    expect(editor).toContain("Remove background");
  });

  it("shows the route's own reason to the customer on a failed generation", () => {
    expect(studio).toContain('caught.cause === "explained"');
    expect(studio).not.toContain("The free generator missed or timed out");
  });
});
