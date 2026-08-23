import Link from "next/link";
import { redirect } from "next/navigation";
import { BackToSite } from "@/components/shared/BackToSite";
import { getStaffSession } from "@/lib/admin/auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const existing = await getStaffSession();
  if (existing) redirect(params.next || "/admin");

  return (
    <div className="min-h-[calc(100vh-0px)] grid lg:grid-cols-[minmax(320px,560px)_1fr] bg-bg">
      <div className="flex flex-col justify-center px-sp-5 sm:px-sp-7 py-sp-8">
        <BackToSite href="/" showLogo />
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent m-0">
          Staff access
        </p>
        <h1 className="font-display font-bold text-[clamp(1.75rem,3vw,2.5rem)] leading-tight m-0 mt-2 max-w-[16ch]">
          Sign In to Your Account
        </h1>
        <p className="text-sm text-text-secondary mt-sp-2 mb-sp-5 max-w-[42ch]">
          Internal team and production access only. Customer accounts use{" "}
          <Link href="/account" className="font-bold text-accent hover:underline">
            Personal Login
          </Link>
          .
        </p>

        <form
          action="/admin/auth"
          method="post"
          className="w-full max-w-[420px] space-y-sp-3"
        >
          {params.error && (
            <p
              role="alert"
              className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2.5 m-0"
            >
              {params.error === "rate_limited"
                ? "Too many sign-in attempts. Please wait a few minutes and try again."
                : "That username or password doesn't match our records."}
            </p>
          )}
          <input type="hidden" name="next" value={params.next || "/admin"} />
          <label className="block text-sm font-semibold text-text-primary">
            Username
            <input
              name="username"
              className="mt-1.5 w-full min-h-11 border border-border rounded-sm bg-bg-raised px-3.5 py-3 text-base font-body text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoComplete="username"
              placeholder="you@company.com"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Password
            <input
              name="password"
              type="password"
              className="mt-1.5 w-full min-h-11 border border-border rounded-sm bg-bg-raised px-3.5 py-3 text-base font-body text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoComplete="current-password"
              required
            />
          </label>
          <button
            type="submit"
            className="w-full bg-accent text-white font-bold rounded-md py-3.5 hover:bg-accent-hover transition-colors"
          >
            Login
          </button>
          {/* A "Login with a One-time Code" button, "Forgot Password?" and
              "Sign up!" all linked to /contact. Staff sign-in is a single
              credential issued internally: there is no one-time code, no self
              service reset and no self registration, so all three advertised
              journeys that end nowhere. One-time codes are a customer feature,
              which is why the pointer to the customer login stays. */}
          <p className="text-sm text-text-secondary m-0 pt-1">
            Lost your access?{" "}
            <Link href="/contact" className="font-bold text-accent hover:underline">
              Ask an administrator
            </Link>{" "}
            to reissue it.
          </p>
        </form>
      </div>

            <aside className="relative hidden lg:block min-h-[740px] overflow-hidden bg-[linear-gradient(155deg,var(--color-accent)_0%,#0b1f4a_48%,#0D0D0D_100%)] text-white">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/images/login_hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12), transparent 40%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-sp-7">
          <p className="m-0 text-xs font-bold tracking-[0.16em] uppercase text-white/75">
            Vancouver · Est. 1980 · Screen Printing &amp; Embroidery
          </p>
          <h2 className="font-display font-bold text-[clamp(1.75rem,2.6vw,2.5rem)] leading-tight m-0 mt-2 max-w-[18ch]">
            Design &amp; Print Your Custom Apparel
          </h2>
          <p className="m-0 mt-3 max-w-[48ch] text-white/80 text-sm leading-relaxed">
            Upload your art or design from scratch, preview a real mockup, and
            order — all before you talk to a rep.
          </p>
          {/* Was a five-star glyph and an invented "4.8/5" rating. No review
              data exists behind it, so it said nothing true. */}
          <p className="m-0 mt-4 text-sm font-bold text-white/85">
            Proofed before every print run, since 1980.
          </p>
        </div>
      </aside>
    </div>
  );
}
