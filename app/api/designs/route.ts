import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";
import { designProjectWriteFromBody } from "@/lib/commerce/design-write";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  }
  try {
    const designs = await (await createCommerceClient()).listDesignProjects();
    return NextResponse.json({ designs });
  } catch (caught) {
    const message = caught instanceof CommerceApiError ? caught.message : "Could not load saved designs.";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: { message: "Sign in to save a design." } }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.name !== "string" ||
    !body.name.trim()
  ) {
    return NextResponse.json({ error: { message: "A design name is required." } }, { status: 400 });
  }
  try {
    const write = designProjectWriteFromBody(body as Record<string, unknown>);
    const design = await (await createCommerceClient()).saveDesignProject({
      name: write.name || body.name.trim(),
      garmentProductId: write.garmentProductId ?? null,
      design: write.design,
      artworksBySide: write.artworksBySide,
      proofImageUrl: write.proofImageUrl ?? null,
    });
    return NextResponse.json({ design });
  } catch (caught) {
    const message =
      caught instanceof CommerceApiError ? caught.message : "Could not save the design.";
    return NextResponse.json(
      { error: { message } },
      { status: caught instanceof CommerceApiError ? caught.status : 500 },
    );
  }
}
