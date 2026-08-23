import type { ReactNode } from "react";
import { TickBar } from "@/components/layout/TickBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { headers } from "next/headers";
import { loadStorefrontCategories } from "@/lib/commerce/catalog";
import { createCommerceClient } from "@/lib/commerce/client";
import {
  isPendingStoreAllowedPath,
  PATHNAME_HEADER,
} from "@/lib/commerce/store-cookie";
import { getCustomerSession } from "@/lib/auth/session";
import {
  PUBLIC_STOREFRONT_FALLBACK,
  resolveStoreContext,
} from "@/lib/commerce/store-context";
import { brandColorVars } from "@/lib/utils/color";
import { OrganizationJsonLd } from "@/components/shared/OrganizationJsonLd";
import { StorefrontSync } from "@/components/store/StorefrontSync";
import type { StoreMembershipState } from "@/lib/commerce/membership";

type Membership = StoreMembershipState;

/** Hits the Route Handler that clears the branded-store cookie. Must be a
 *  full document navigation — `<Link>` would land on the SEO catch-all. */
function LeaveStoreLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- route.ts, not a page
    <a href="/leave-store" className={className}>
      {children}
    </a>
  );
}

/**
 * Whether the visitor belongs to the store they are looking at.
 *
 * Only asked of a private team store: on the operator's own shop everyone is
 * welcome, and asking would cost a request per render for an answer that is
 * always yes. Any failure answers "n/a" — this decides what to explain, and a
 * membership lookup that times out is no reason to accuse someone of not
 * belonging, nor to take down the shell.
 */
async function storeMembership(
  store: { isPublic: boolean; accountId: string },
  personId: string | undefined,
): Promise<Membership> {
  if (store.isPublic) return "n/a";
  if (!personId) return "signed-out";
  try {
    const memberships = await (
      await createCommerceClient()
    ).listMyMemberships(personId);
    return memberships.some((m) => m.accountId === store.accountId)
      ? "member"
      : "not-a-member";
  } catch {
    return "n/a";
  }
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Store resolution must never take down the whole shop shell — layout
  // errors bubble past (shop)/error.tsx into global-error.
  const [categories, customerSession, store] = await Promise.all([
    loadStorefrontCategories(),
    getCustomerSession().catch(() => null),
    resolveStoreContext().catch(() => PUBLIC_STOREFRONT_FALLBACK),
  ]);

  const isBranded = Boolean(store.accentColor || store.logoUrl);

  // A team store admits its members only. Someone who followed a colleague's
  // link can otherwise browse it, design a garment and be refused at the very
  // last step, by an API error about tenants that means nothing to them. Say
  // so at the top instead, while it still costs them nothing.
  const membership = await storeMembership(store, customerSession?.personId);

  // A store awaiting approval must not be shoppable, but its owner still has
  // to reach account pages (invites) and the design studio so the team can
  // prepare artwork while they wait. Gating the whole route group sealed
  // those out the moment they created the store.
  const allowedWhilePending = isPendingStoreAllowedPath(
    (await headers()).get(PATHNAME_HEADER) ?? "",
  );

  if (store.status !== "active" && !allowedWhilePending) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display font-bold text-2xl mb-2">
            {store.name} isn&apos;t live yet
          </h1>
          <p className="text-text-secondary max-w-[48ch]">
            {store.status === "pending_review"
              ? "This store is still being reviewed. Check back shortly."
              : "This store isn't currently available."}
          </p>
          <LeaveStoreLink className="text-sm underline">
            Go to the main Great West Graphics shop
          </LeaveStoreLink>
        </div>
      </div>
    );
  }

  const brandVars = brandColorVars(store.accentColor);

  return (
    <div style={brandVars as React.CSSProperties | undefined}>
      <StorefrontSync slug={store.slug} isPublic={store.isPublic} />
      {!isBranded && <OrganizationJsonLd />}
      {isBranded && (
        <div className="bg-fill-subtle border-b border-border text-sm">
          <div className="mx-auto max-w-[1280px] px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <span>
              You are shopping the <b>{store.name}</b> team store.
            </span>
            <LeaveStoreLink className="underline whitespace-nowrap">
              Shop the main site instead
            </LeaveStoreLink>
          </div>
        </div>
      )}
      {membership === "signed-out" && (
        <div
          role="status"
          className="bg-amber-50 border-b border-amber-300 text-amber-900 text-sm"
        >
          <div className="mx-auto max-w-[1280px] px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <span>
              <b>{store.name}</b> is a team store. Sign in to join it and
              place an order.
            </span>
            <a
              href={`/account?next=${encodeURIComponent(`/s/${store.slug}`)}`}
              className="underline whitespace-nowrap"
            >
              Sign in
            </a>
          </div>
        </div>
      )}
      {membership === "not-a-member" && (
        <div
          role="status"
          className="bg-amber-50 border-b border-amber-300 text-amber-900 text-sm"
        >
          <div className="mx-auto max-w-[1280px] px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <span>
              You are browsing <b>{store.name}</b> as a guest. You can order right
              away — checking out adds you to the store automatically, no invitation
              needed.
            </span>
            <LeaveStoreLink className="underline whitespace-nowrap">
              Shop the main site
            </LeaveStoreLink>
          </div>
        </div>
      )}
      <TickBar />
      <Header
        categories={categories}
        customerName={customerSession?.name || customerSession?.email || null}
        storeName={isBranded ? store.name : undefined}
        storeLogoUrl={store.logoUrl}
      />

      <main>{children}</main>

      <Footer categories={categories} storeName={isBranded ? store.name : undefined} />

      {!isBranded && <ThemeToggle />}
    </div>
  );
}
