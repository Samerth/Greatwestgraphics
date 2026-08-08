import { NextResponse } from "next/server";

/** Liveness probe for containers / ALB. Does not check the commerce API or DB. */
export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
