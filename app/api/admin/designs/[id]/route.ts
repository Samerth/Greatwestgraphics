import { NextRequest, NextResponse } from "next/server";
import { adminToken, getStaffSession } from "@/lib/admin/auth";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Staff sign-in required." } },
      { status: 401 },
    );
  }
  const { id } = await params;
  try {
    const design = await (
      await createCommerceClient()
    ).getAdminDesignProject(adminToken(), id);
    return NextResponse.json({ design });
  } catch (caught) {
    const message =
      caught instanceof CommerceApiError ? caught.message : "Design not found.";
    return NextResponse.json({ error: { message } }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Staff sign-in required." } },
      { status: 401 },
    );
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: { message: "Invalid request body." } },
      { status: 400 },
    );
  }
  try {
    const design = await (
      await createCommerceClient()
    ).updateAdminDesignProject(adminToken(), id, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      // Presence, not truthiness: an explicit null clears the garment, and
      // collapsing it to undefined would silently keep the old one.
      ...("garmentProductId" in body
        ? { garmentProductId: body.garmentProductId }
        : {}),
      ...("design" in body ? { design: body.design } : {}),
      ...("proofImageUrl" in body
        ? { proofImageUrl: body.proofImageUrl }
        : {}),
    });
    return NextResponse.json({ design });
  } catch (caught) {
    // A rejected write (artwork that would not survive a reload comes back as
    // a 409) is the studio's only chance to tell the operator what to fix, so
    // both the message and the status travel through untouched.
    const message =
      caught instanceof CommerceApiError
        ? caught.message
        : "Could not update the design.";
    return NextResponse.json(
      { error: { message } },
      { status: caught instanceof CommerceApiError ? caught.status : 500 },
    );
  }
}
