import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageStore, StoredImage } from "./image-store";

const ROOT = path.join(process.cwd(), ".data", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};

function resolveWithinRoot(key: string): string | null {
  const filePath = path.join(ROOT, key);
  // A bare startsWith(ROOT) also accepts siblings whose name merely begins
  // with the root's, so `../uploads-private/secret.png` would have escaped.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return null;
  return filePath;
}

/**
 * Dev-only fallback used when no S3 bucket is configured. Writes outside
 * `public/` (served instead through `/api/uploads/[...key]`) so uploads
 * don't get bundled as static assets and work the same whether or not the
 * app has been built. Not suitable for serverless/multi-instance
 * production — that's what S3ImageStore is for.
 */
export class LocalImageStore implements ImageStore {
  async put(key: string, data: Buffer): Promise<string> {
    const filePath = resolveWithinRoot(key);
    if (!filePath) throw new Error("Invalid storage key");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return `/api/uploads/${key}`;
  }

  async get(key: string): Promise<StoredImage | null> {
    const filePath = resolveWithinRoot(key);
    if (!filePath) return null;
    try {
      return {
        data: await readFile(filePath),
        contentType:
          CONTENT_TYPES[key.split(".").pop() || ""] || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
}
