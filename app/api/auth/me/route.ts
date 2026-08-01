import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ signedIn: false });
  return NextResponse.json({
    signedIn: true,
    email: session.email,
    name: session.name,
  });
}
