import { NextResponse } from "next/server";
import { loadStorefrontProduct } from "@/lib/commerce/catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await loadStorefrontProduct(id);
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Product not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json(detail);
}
