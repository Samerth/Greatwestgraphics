import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin/auth";
import { getImageStore } from "@/lib/storage";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const MAX_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Staff sign-in is required to upload artwork." } },
      { status: 401 },
    );
  }

  const form = await request.formData();
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

  // Artwork staff add on a customer's behalf has to sit under that customer's
  // prefix, because the upload reader only serves a customer files filed
  // there — anything else would be invisible to the person whose design it
  // is. The `staff-` name keeps it attributable without moving it out of
  // their reach. A malformed id falls back to the staff-only prefix rather
  // than being interpolated into a storage key.
  const requestedPersonId = request.nextUrl.searchParams.get("personId");
  const personId = UUID_PATTERN.test(requestedPersonId ?? "")
    ? requestedPersonId
    : null;
  const key = personId
    ? `designs/${personId}/staff-${randomUUID()}.${extension}`
    : `designs/staff/${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await getImageStore().put(key, buffer, file.type);

  return NextResponse.json({ url });
}
