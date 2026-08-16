import { NextResponse } from "next/server";
import { loadStorefrontProduct } from "@/lib/commerce/catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await loadStorefrontProduct(id);

  // A catalogue outage used to be reported here as a 404, which told every
  // caller — including the design studio's product fetch — that the product
  // had been deleted. 503 says "ask again later", which is what we mean.
  if (result.kind === "unavailable") {
    return NextResponse.json(
      {
        error: {
          code: "CATALOG_UNAVAILABLE",
          message: "The catalogue is temporarily unavailable.",
        },
      },
      { status: 503 },
    );
  }
  if (result.kind === "missing") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Product not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json(result.detail);
}
