import { NextRequest, NextResponse } from "next/server";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";

/** Mirrors the commerce API's own cap. Bounded here too so this route does not
 * depend on the service behind it to defend itself. */
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(requested)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(requested)))
    : 12;
  const search = request.nextUrl.searchParams.get("search")?.trim() || undefined;
  const catalog = await loadStorefrontCatalog({ limit, search });
  return NextResponse.json({ products: catalog.products });
}
