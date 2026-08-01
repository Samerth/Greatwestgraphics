import { NextRequest, NextResponse } from "next/server";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit")) || 12;
  const catalog = await loadStorefrontCatalog({ limit });
  return NextResponse.json({ products: catalog.products });
}
