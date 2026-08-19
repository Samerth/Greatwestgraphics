import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";
import { existingTeamStorePath } from "@/lib/commerce/membership";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ destination: null }, { status: 401 });
  }
  try {
    const memberships = await (
      await createCommerceClient()
    ).listMyMemberships(session.personId);
    return NextResponse.json({
      destination: existingTeamStorePath(memberships),
    });
  } catch {
    return NextResponse.json(
      { destination: null, error: "unavailable" },
      { status: 503 },
    );
  }
}
