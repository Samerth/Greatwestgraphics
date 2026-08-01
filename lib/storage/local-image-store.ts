import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageStore } from "./image-store";

const ROOT = path.join(process.cwd(), ".data", "uploads");

/**
 * Dev-only fallback used when no S3 bucket is configured. Writes outside
 * `public/` (served instead through `/api/uploads/[...key]`) so uploads
 * don't get bundled as static assets and work the same whether or not the
 * app has been built. Not suitable for serverless/multi-instance
 * production — that's what S3ImageStore is for.
 */
export class LocalImageStore implements ImageStore {
  async put(key: string, data: Buffer): Promise<string> {
    const filePath = path.join(ROOT, key);
    if (!filePath.startsWith(ROOT)) {
      throw new Error("Invalid storage key");
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return `/api/uploads/${key}`;
  }
}
