import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const ROOT = path.join(process.cwd(), ".data", "uploads");
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const relative = key.join("/");
  const filePath = path.join(ROOT, relative);
  // A bare startsWith(ROOT) also accepts siblings whose name merely begins with
  // the root's, so `../uploads-private/secret.png` would have escaped. Compare
  // against the root plus its separator instead.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return NextResponse.json({ error: { message: "Invalid key" } }, { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    const extension = relative.split(".").pop() || "";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": CONTENT_TYPES[extension] || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }
}
