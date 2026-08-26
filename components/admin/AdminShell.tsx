"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/designs", label: "Designs" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/pricing/v2", label: "Pricing" },
  // Legacy v1 pricing page removed from nav (not deleted) — it's kept alive
  // only to re-price pre-migration job-request lines that still reference a
  // v1 snapshot (see repriceLine in job-request-service.ts). Reachable at
  // /admin/pricing directly if that ever comes up; restore this row to bring
  // it back into the sidebar.
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/sync", label: "Sync" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export function AdminShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username?: string;
}) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Longest match wins, so /admin/pricing/v2 doesn't also light up /admin/pricing.
  const activeHref = NAV.reduce<string | null>((best, item) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    return best && best.length >= item.href.length ? best : item.href;
  }, null);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex">
      <aside className="w-60 shrink-0 border-r border-border bg-bg-raised p-sp-4 flex flex-col gap-sp-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
            Staff admin
          </p>
          <p className="font-display font-bold text-lg m-0">Great West Graphics</p>
          {username && (
            <p className="text-xs text-text-tertiary mt-1 mb-0">
              Signed in as {username}
            </p>
          )}
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-sm px-3 py-2 text-sm font-semibold border ${
                  active
                    ? "bg-fill-subtle-15 border-border text-accent"
                    : "border-transparent hover:bg-fill-subtle-15 hover:border-border"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action="/admin/logout" method="post" className="mt-auto">
          <button
            type="submit"
            className="text-sm font-bold text-text-secondary hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-sp-6 overflow-auto">{children}</main>
    </div>
  );
}
