import { redirect } from "next/navigation";
import { createStaffSession, staffCredentials } from "@/lib/admin/auth";

function safeNextPath(raw: FormDataEntryValue | null): string {
  const next = String(raw || "/admin");
  return next.startsWith("/admin") ? next : "/admin";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const next = safeNextPath(formData.get("next"));
  const expected = staffCredentials();

  if (
    !expected.password ||
    username !== expected.user ||
    password !== expected.password
  ) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  await createStaffSession(username);
  redirect(next);
}
