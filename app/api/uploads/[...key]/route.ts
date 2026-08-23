import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin/auth";
import { getCustomerSession } from "@/lib/auth/session";
import { getImageStore } from "@/lib/storage";
import {
  canReadUploadedObject,
  isPublicUploadKey,
} from "@/lib/storage/upload-access";

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
  // Store logos are the exception: the branded header and pending-review list
  // render them for people who are not signed in as the owner.
  //
  // This is the read side for every backing store, not just the local one: a
  // private S3 bucket cannot be fetched from the browser directly, so uploads
  // come back through here and this check is the access control for them.
  const publicLogo = isPublicUploadKey(relative);
  if (!publicLogo) {
    const staff = Boolean(await getStaffSession());
    const session = staff ? null : await getCustomerSession();
    if (
      !canReadUploadedObject(relative, {
        isStaff: staff,
        personId: session?.personId,
      })
    ) {
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
      "cache-control": isPublicUploadKey(relative)
        ? "public, max-age=31536000, immutable"
        : "private, max-age=31536000, immutable",
    },
  });
}
