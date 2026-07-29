import { redirect } from "next/navigation";
import {
  createStaffSession,
  getStaffSession,
  staffCredentials,
} from "@/lib/admin/auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const existing = await getStaffSession();
  if (existing) redirect(params.next || "/admin");

  async function login(formData: FormData) {
    "use server";
    const username = String(formData.get("username") || "");
    const password = String(formData.get("password") || "");
    const next = String(formData.get("next") || "/admin");
    const expected = staffCredentials();
    if (
      !expected.password ||
      username !== expected.user ||
      password !== expected.password
    ) {
      redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
    }
    await createStaffSession(username);
    redirect(next.startsWith("/admin") ? next : "/admin");
  }

  return (
    <div className="min-h-screen grid place-items-center bg-bg p-sp-5">
      <form
        action={login}
        className="w-full max-w-md border border-border rounded-lg bg-bg-raised p-sp-5 space-y-sp-3"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Staff access
        </p>
        <h1 className="font-display font-bold text-2xl m-0">Admin sign in</h1>
        {params.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm p-2">
            Invalid username or password.
          </p>
        )}
        <input type="hidden" name="next" value={params.next || "/admin"} />
        <label className="block text-sm font-semibold">
          Username
          <input
            name="username"
            className="mt-1 w-full border border-border rounded-sm px-3 py-2"
            autoComplete="username"
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            name="password"
            type="password"
            className="mt-1 w-full border border-border rounded-sm px-3 py-2"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          className="w-full bg-accent text-white font-bold rounded-md py-3"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
