import { redirect } from "next/navigation";
import { clearStaffSession } from "@/lib/admin/auth";

export async function POST() {
  await clearStaffSession();
  redirect("/admin/login");
}
