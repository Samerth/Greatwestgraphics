import { NextResponse } from "next/server";
import { adminToken, getStaffSession } from "@/lib/admin/auth";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Staff sign-in required." } },
      { status: 401 },
    );
  }
  try {
    const runs = await (
      await createCommerceClient()
    ).listSyncRuns(adminToken());
    return NextResponse.json({ runs });
  } catch (caught) {
    const message =
      caught instanceof CommerceApiError
        ? caught.message
        : "Sync history is unavailable right now.";
    return NextResponse.json(
      { error: { message } },
      { status: caught instanceof CommerceApiError ? caught.status : 500 },
    );
  }
}
