import { NextResponse } from "next/server";
import { createCommerceClient } from "@/lib/commerce/client";

export async function GET(request: Request) {
  const base = new URL(request.url).searchParams.get("base") || "";
  if (!base.trim()) return NextResponse.json({ slug: "" });
  try {
    const client = await createCommerceClient();
    const result = await client.suggestStoreSlug(base);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ slug: "" });
  }
}
