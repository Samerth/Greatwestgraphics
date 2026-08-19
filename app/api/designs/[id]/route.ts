import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";
import { designProjectWriteFromBody } from "@/lib/commerce/design-write";

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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }
  try {
    const design = await (await createCommerceClient()).updateDesignProject(
      id,
      designProjectWriteFromBody(body as Record<string, unknown>),
    );
    return NextResponse.json({ design });
  } catch (caught) {
    const message =
      caught instanceof CommerceApiError ? caught.message : "Could not update the design.";
    return NextResponse.json(
      { error: { message } },
      { status: caught instanceof CommerceApiError ? caught.status : 500 },
    );
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
