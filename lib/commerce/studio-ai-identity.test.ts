import { describe, expect, it } from "vitest";
import {
  buildStudioIdentityPrompt,
  fetchStudioIdentityBlob,
  isUsableStudioIdentityBlob,
  nextStudioIdentitySeed,
  normalizeStudioIdentityPrompt,
  parseStudioIdentityFluxImageUrl,
  resolveStudioIdentityFluxFileUrl,
  studioIdentityFilename,
  studioIdentityFluxBody,
  studioIdentityFluxEventUrl,
  studioIdentityFluxSubmitUrl,
  studioIdentityImageUrl,
  studioIdentityPlacementZone,
  STUDIO_AI_IDENTITY_MODEL,
} from "./studio-ai-identity";

describe("studio AI identity (FLUX.1-schnell)", () => {
  it("uses Flux as the named generator", () => {
    expect(STUDIO_AI_IDENTITY_MODEL).toBe("flux-schnell");
  });

  it("wraps the shopper prompt as a flat identity mark, not a scene", () => {
    const prompt = buildStudioIdentityPrompt("  mountain badge for staff  ");
    expect(prompt.startsWith("mountain badge for staff, ")).toBe(true);
    expect(prompt).toContain("isolated on pure white");
    expect(prompt).toContain("no photorealism");
    expect(prompt).toContain("no garment");
    expect(prompt).toContain("follow the shopper request exactly");
  });

  it("builds a Flux submit body with a stable seed", () => {
    const body = studioIdentityFluxBody("wolf crest", 42);
    expect(body.data[0]).toContain("wolf crest");
    expect(body.data[1]).toBe(42);
    expect(body.data[2]).toBe(false);
    expect(body.data[3]).toBe(1024);
    expect(body.data[5]).toBe(4);
    expect(studioIdentityFluxSubmitUrl()).toContain(
      "black-forest-labs-flux-1-schnell.hf.space",
    );
    expect(studioIdentityFluxEventUrl("abc")).toContain("/call/infer/abc");
  });

  it("keeps a Pollinations URL as the fallback generator", () => {
    const url = studioIdentityImageUrl("wolf crest", 42);
    expect(url.startsWith("https://image.pollinations.ai/prompt/")).toBe(true);
    expect(url).toContain("seed=42");
    expect(url).toContain("nologo=true");
    expect(url).toContain("width=1024");
    expect(decodeURIComponent(url)).toContain("wolf crest");
  });

  it("reads the Flux image URL from a Gradio SSE payload", () => {
    const sse = [
      "event: complete",
      'data: [{"url":"/gradio_api/file=/tmp/gradio/mark.webp"}, 42]',
      "",
    ].join("\n");
    expect(parseStudioIdentityFluxImageUrl(sse)).toBe(
      "https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=/tmp/gradio/mark.webp",
    );
    expect(
      resolveStudioIdentityFluxFileUrl(
        "https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=/tmp/x.png",
      ),
    ).toBe(
      "https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=/tmp/x.png",
    );
    expect(parseStudioIdentityFluxImageUrl("event: error\ndata: null\n")).toBe(
      null,
    );
  });

  it("collapses prompt whitespace before wrapping", () => {
    expect(normalizeStudioIdentityPrompt("  wolf   head  ")).toBe("wolf head");
  });

  it("places the try-out on the full plate so it is readable", () => {
    expect(studioIdentityPlacementZone("front")).toBe("Full Front");
    expect(studioIdentityPlacementZone("back")).toBe("Full Back");
    expect(studioIdentityPlacementZone("left")).toBe("Left Side Panel");
    expect(studioIdentityPlacementZone("right")).toBe("Right Side Panel");
  });

  it("names the saved file from the prompt so they can keep it", () => {
    expect(studioIdentityFilename("Wolf Crest 2026")).toBe(
      "identity-wolf-crest-2026.png",
    );
    expect(studioIdentityFilename("Wolf Crest 2026", "image/jpeg")).toBe(
      "identity-wolf-crest-2026.jpg",
    );
    expect(studioIdentityFilename("Wolf Crest 2026", "image/webp")).toBe(
      "identity-wolf-crest-2026.webp",
    );
    expect(studioIdentityFilename("???")).toBe("identity-mark.png");
  });

  it("fetches Flux first and downloads the returned file", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/gradio_api/call/infer")) {
        return Response.json({ event_id: "evt-1" });
      }
      if (url.endsWith("/gradio_api/call/infer/evt-1")) {
        return new Response(
          'event: complete\ndata: [{"url":"https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=/tmp/mark.webp"}]\n\n',
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        );
      }
      if (url.includes("/gradio_api/file")) {
        return new Response(new Uint8Array(9_000), {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };
    const blob = await fetchStudioIdentityBlob("wolf crest", 7, fetchImpl);
    expect(blob.size).toBe(9_000);
    expect(blob.type).toBe("image/webp");
    expect(calls[0]).toContain("POST");
    expect(calls[0]).toContain("/gradio_api/call/infer");
  });

  it("falls back to Pollinations when Flux misses", async () => {
    const pollinations = studioIdentityImageUrl("wolf crest", 7);
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("hf.space")) {
        return new Response("nope", { status: 503 });
      }
      expect(url).toBe(pollinations);
      return new Response(new Uint8Array(9_000), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    };
    const blob = await fetchStudioIdentityBlob("wolf crest", 7, fetchImpl);
    expect(blob.size).toBe(9_000);
    expect(blob.type).toBe("image/png");
  });

  it("rejects a tiny fallback payload", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(new Uint8Array(100), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    await expect(
      fetchStudioIdentityBlob("wolf crest", 7, fetchImpl),
    ).rejects.toThrow(/unusable|Generation failed/);
  });

  it("rejects tiny or non-image blobs", () => {
    expect(isUsableStudioIdentityBlob(new Blob(["x"], { type: "image/png" }))).toBe(
      false,
    );
    expect(
      isUsableStudioIdentityBlob(
        new Blob([new Uint8Array(9_000)], { type: "text/html" }),
      ),
    ).toBe(false);
    expect(
      isUsableStudioIdentityBlob(
        new Blob([new Uint8Array(9_000)], { type: "image/png" }),
      ),
    ).toBe(true);
  });

  it("does not call Math.random itself when a rng is passed", () => {
    expect(nextStudioIdentitySeed(() => 0.5)).toBe(500_000_000);
  });
});
