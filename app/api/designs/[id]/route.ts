import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  }
  const { id } = await params;
  try {
    const design = await (await createCommerceClient()).getDesignProject(id);
    return NextResponse.json({ design });
  } catch (caught) {
    const message = caught instanceof CommerceApiError ? caught.message : "Design not found.";
    return NextResponse.json({ error: { message } }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }
  try {
    const design = await (await createCommerceClient()).updateDesignProject(id, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      garmentProductId: body.garmentProductId ?? undefined,
      artworksBySide: body.artworksBySide,
      proofImageUrl: body.proofImageUrl ?? undefined,
    });
    return NextResponse.json({ design });
  } catch (caught) {
    const message = caught instanceof CommerceApiError ? caught.message : "Could not update the design.";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  }
  const { id } = await params;
  try {
    await (await createCommerceClient()).deleteDesignProject(id);
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof CommerceApiError ? caught.message : "Could not delete the design.";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
