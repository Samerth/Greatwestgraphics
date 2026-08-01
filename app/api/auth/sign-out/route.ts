import { NextResponse } from "next/server";
import { clearCustomerSession } from "@/lib/auth/session";

export async function POST() {
  await clearCustomerSession();
  return NextResponse.json({ status: "signed_out" });
}
