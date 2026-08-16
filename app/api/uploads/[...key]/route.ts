import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin/auth";
import { getCustomerSession } from "@/lib/auth/session";
import { getImageStore } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const relative = key.join("/");

  // Customer artwork is private, and the keys are guessable enough that serving
  // them to anonymous callers is not defensible. Staff are allowed anything in
  // the store, because reviewing customer artwork is what proofing is; a
  // customer is allowed only what the upload route filed under their own id.
  //
  // This is the read side for every backing store, not just the local one: a
  // private S3 bucket cannot be fetched from the browser directly, so uploads
  // come back through here and this check is the access control for them.
  if (!(await getStaffSession())) {
    const session = await getCustomerSession();
    const owned = session
      ? relative.startsWith(`designs/${session.personId}/`)
      : false;
    if (!owned) {
      return NextResponse.json(
        { error: { message: "Not found" } },
        { status: 404 },
      );
    }
  }

  const stored = await getImageStore().get(relative);
  if (!stored) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(stored.data), {
    headers: {
      "content-type": stored.contentType,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
