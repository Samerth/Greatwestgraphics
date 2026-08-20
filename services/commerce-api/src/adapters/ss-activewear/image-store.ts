import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathHash, ssImageUrl } from "./client.js";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));

export class LocalSsImageStore {
  constructor(
    private readonly rootDir = path.join(repoRoot, "public", "vendor", "ss"),
  ) {}

  async ensure(remotePath: string | null | undefined): Promise<string | null> {
    if (!remotePath) return null;
    const absoluteRemote = ssImageUrl(remotePath);
    if (!absoluteRemote) return null;
    // Hosts without a durable local disk (ephemeral containers) so
    // downloading into public/ only works for a machine that both syncs and
    // serves. SS_IMAGE_STORAGE=remote stores the S&S CDN URL directly —
    // next.config.ts already whitelists ssactivewear.com for next/image.
    if (process.env.SS_IMAGE_STORAGE === "remote") return absoluteRemote;
    const hash = pathHash(remotePath);
    const ext = path.extname(remotePath).split("?")[0] || ".jpg";
    const fileName = `${hash}${ext}`;
    const absPath = path.join(this.rootDir, fileName);
    const publicUrl = `/vendor/ss/${fileName}`;

    try {
      await access(absPath);
      return publicUrl;
    } catch {
      // download
    }

    await mkdir(this.rootDir, { recursive: true });
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const response = await fetch(absoluteRemote, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new Error(`Image download failed ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentHash = createHash("sha1").update(buffer).digest("hex");
        void contentHash;
        await writeFile(absPath, buffer);
        return publicUrl;
      } catch (error) {
        if (attempt >= 3) {
          console.warn("Failed to download S&S image", remotePath, error);
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    return null;
  }
}
