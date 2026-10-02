import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin/auth";
import { getCustomerSession } from "@/lib/auth/session";
import { getGuestId } from "@/lib/auth/guest-identity";
import { getImageStore } from "@/lib/storage";
import {
  canReadUploadedObject,
  isPublicUploadKey,
} from "@/lib/storage/upload-access";

export async function GET(
  request: NextRequest,
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
    // Both are checked, not one-or-the-other: covers a guest who uploaded
    // artwork under their guest id and then signed in later in the same
    // browser session — their file is still filed under the guest id, so
    // dropping that check the moment a session exists would 404 their own
    // just-uploaded artwork.
    const guestId = staff ? null : await getGuestId();
    if (
      !canReadUploadedObject(relative, {
        isStaff: staff,
        personId: session?.personId,
        guestId,
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

  const headers: Record<string, string> = {
    "content-type": stored.contentType,
    "cache-control": isPublicUploadKey(relative)
      ? "public, max-age=31536000, immutable"
      : "private, max-age=31536000, immutable",
  };

  // `<a download>` is silently ignored by the browser once this file's URL
  // is cross-origin — which is exactly the case whenever AWS_S3_PUBLIC_BASE_URL
  // is set — so a caller that wants a real save-to-disk (the admin artwork
  // download links) asks for it explicitly instead of relying on that
  // attribute. The name is attacker-controlled input reflected into a
  // header, so it is quoted and stripped of quote/control characters rather
  // than passed through raw.
  const downloadName = request.nextUrl.searchParams.get("download");
  if (downloadName) {
    const safeName = downloadName.replace(/[\r\n"]/g, "").slice(0, 200) || "download";
    headers["content-disposition"] = `attachment; filename="${safeName}"`;
  }

  return new NextResponse(new Uint8Array(stored.data), { headers });
}
