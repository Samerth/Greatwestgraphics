import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { getImageStore } from "@/lib/storage";
import { parseUploadPurpose, uploadObjectKey } from "@/lib/storage/upload-access";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Sign in to upload artwork." } },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const purpose = parseUploadPurpose(form.get("purpose"));
  if (!purpose) {
    return NextResponse.json(
      { error: { message: "Unknown upload purpose." } },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { message: "No file provided." } },
      { status: 400 },
    );
  }
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: { message: "Unsupported file type — use PNG, JPG or SVG." } },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: { message: "File is too large — max 10MB." } },
      { status: 400 },
    );
  }

  const key = uploadObjectKey(purpose, session.personId, randomUUID(), extension);
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await getImageStore().put(key, buffer, file.type);

  return NextResponse.json({ url });
}
