import { NextRequest, NextResponse } from "next/server";
import { adminToken, getStaffSession } from "@/lib/admin/auth";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

function positiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Staff sign-in required." } },
      { status: 401 },
    );
  }
  const { searchParams } = new URL(request.url);
  try {
    const designs = await (
      await createCommerceClient()
    ).listAdminDesignProjects(adminToken(), {
      limit: positiveInt(searchParams.get("limit")),
      offset: positiveInt(searchParams.get("offset")),
    });
    return NextResponse.json({ designs });
  } catch (caught) {
    const message =
      caught instanceof CommerceApiError
        ? caught.message
        : "Customer designs are unavailable right now.";
    return NextResponse.json(
      { error: { message } },
      { status: caught instanceof CommerceApiError ? caught.status : 500 },
    );
  }
}
