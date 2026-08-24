"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { useCartStore } from "@/lib/store/cart";
import { ActiveDesignBadge } from "@/components/design/ActiveDesignBadge";
import { SignOutButton } from "@/components/account/SignOutButton";
import type { StorefrontCategory } from "@/lib/commerce/catalog";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

// Used only when the commerce API returned no categories. This was a list of
// eight hand-written slugs, seven of which ("apparel", "bags", "outerwear",
// "promo", "safety", "signs-displays", "hats-beanies") do not exist in the
// catalogue — the real ones are "tote-bags", "hats" and so on. Every one of
// them resolved to a 200 page with an empty grid. When we genuinely do not
// know the catalogue's categories, send people to the unfiltered listing
// rather than guessing at slugs.
const FALLBACK_CATEGORIES = [{ label: "All Products", href: "/products" }];

type CategoryNode = StorefrontCategory & { children: StorefrontCategory[] };

function buildCategoryTree(categories: StorefrontCategory[]): CategoryNode[] {
  return categories
    .filter((c) => !c.parentId)
    .map((top) => ({
      ...top,
      children: categories.filter((c) => c.parentId === top.id),
    }));
}

const PRIMARY_LINKS = [
  { label: "AI Design Studio", href: "/design" },
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Header({
  categories = [],
  customerName = null,
  storeName,
  storeLogoUrl = null,
}: {
  categories?: StorefrontCategory[];
  customerName?: string | null;
  /** Set only for a branded corporate store — swaps the GWG logo/name. */
  storeName?: string;
  storeLogoUrl?: string | null;
}) {
  const CATEGORIES =
    categories.length > 0
      ? categories.map((c) => ({
          label: c.name,
          href: `/products?category=${encodeURIComponent(c.slug)}`,
        }))
      : FALLBACK_CATEGORIES;
  const CATEGORY_TREE: CategoryNode[] =
    categories.length > 0 ? buildCategoryTree(categories) : [];
  const HAS_CATEGORIES = CATEGORY_TREE.length > 0;
  const rawPieceCount = useCartStore((s) => s.pieceCount());
  // Zustand's persist middleware only reads localStorage on the client, so
  // the server always renders an empty cart. Gate the real count behind a
  // post-mount flag so the first client render matches the server's, then
  // update — otherwise React logs a hydration mismatch for any returning
  // visitor who already has items in their cart.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pieceCount = mounted ? rawPieceCount : 0;

  const [shopOpen, setShopOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const openShop = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShopOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setShopOpen(false), 120);
  };
  const openAccount = () => {
    if (accountTimer.current) clearTimeout(accountTimer.current);
    setAccountOpen(true);
  };
  const scheduleAccountClose = () => {
    accountTimer.current = setTimeout(() => setAccountOpen(false), 120);
  };

  return (
    <header className="sticky top-0 z-[60] bg-bg-90 backdrop-blur-lg border-b border-border">
      <Container className="h-[76px] flex items-center justify-between gap-sp-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {storeName ? (
            storeLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeLogoUrl}
                alt={storeName}
                className="h-9 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <span className="font-display font-bold text-lg">{storeName}</span>
            )
          ) : (
            <Image
              src="/images/logo-mark.png"
              alt="Great West Graphics"
              width={366}
              height={209}
              priority
              className="h-12 w-auto"
            />
          )}
        </Link>

        {/* Primary nav */}
        <nav className="hidden lg:flex items-center gap-sp-5">
          {/* Shop dropdown */}
          <div
            className="relative"
            onMouseEnter={openShop}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              onClick={() => setShopOpen((v) => !v)}
              aria-expanded={shopOpen}
              className="relative flex items-center gap-1.5 font-bold text-body text-text-primary py-1 group"
            >
              Shop
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 8"
                fill="none"
                className={`transition-transform duration-med ${
                  shopOpen ? "rotate-180" : ""
                }`}
              >
                <path
                  d="M1 1.5L6 6.5L11 1.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-accent scale-x-0 origin-left transition-transform duration-med group-hover:scale-x-100" />
            </button>

            {shopOpen && (
              <div
                onMouseEnter={openShop}
                onMouseLeave={scheduleClose}
                className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[820px] max-w-[92vw]"
              >
                <div className="rounded-xl border border-border bg-bg shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-sp-4 max-h-[70vh] overflow-y-auto">
                  {HAS_CATEGORIES ? (
                    <div className="grid grid-cols-3 gap-x-sp-4 gap-y-sp-4">
                      {CATEGORY_TREE.map((cat) => (
                        <div key={cat.id}>
                          <Link
                            href={`/products?category=${encodeURIComponent(cat.slug)}`}
                            onClick={() => setShopOpen(false)}
                            className="block text-sm font-bold text-text-primary hover:text-accent transition-colors mb-1.5"
                          >
                            {cat.name}
                          </Link>
                          {cat.children.length > 0 && (
                            <ul className="space-y-1 m-0 p-0 list-none">
                              {cat.children.map((child) => (
                                <li key={child.id}>
                                  <Link
                                    href={`/products?category=${encodeURIComponent(child.slug)}`}
                                    onClick={() => setShopOpen(false)}
                                    className="block text-xs text-text-secondary hover:text-accent transition-colors py-0.5"
                                  >
                                    {child.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-sp-4 gap-y-1">
                      {FALLBACK_CATEGORIES.map((cat) => (
                        <Link
                          key={cat.label}
                          href={cat.href}
                          onClick={() => setShopOpen(false)}
                          className="rounded-md px-3 py-2.5 text-sm font-semibold text-text-primary hover:bg-fill-subtle-15 hover:text-accent transition-colors"
                        >
                          {cat.label}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="mt-sp-3 pt-sp-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">
                      Not sure what you need?
                    </span>
                    <Link
                      href="/products"
                      onClick={() => setShopOpen(false)}
                      className="text-xs font-bold text-accent hover:underline"
                    >
                      View all products →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="relative font-bold text-body text-text-primary py-1 group"
            >
              {link.label}
              <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-accent scale-x-0 origin-left transition-transform duration-med group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-sp-2 shrink-0">
          <ActiveDesignBadge />
          {customerName ? (
            <div
              className="relative hidden sm:block"
              onMouseEnter={openAccount}
              onMouseLeave={scheduleAccountClose}
            >
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
                className="inline-flex items-center px-3.5 py-2 text-sm font-bold rounded-md border border-border hover:border-text-tertiary hover:bg-fill-subtle-15 transition-colors"
              >
                Your account
              </button>
              {accountOpen && (
                <div
                  onMouseEnter={openAccount}
                  onMouseLeave={scheduleAccountClose}
                  className="absolute right-0 top-full pt-2 w-[300px] z-50"
                >
                  <div className="rounded-md border border-border bg-bg-raised shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-2">
                    <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-tertiary m-0">
                      Signed in as {customerName.split(" ")[0]}
                    </p>
                    <Link
                      href="/portal"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">Customer portal</span>
                      <span className="block text-xs text-text-secondary mt-1">
                        Overview of proofs, quotes, and saved artwork.
                      </span>
                    </Link>
                    <Link
                      href="/portal/jobs"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">Your orders</span>
                      <span className="block text-xs text-text-secondary mt-1">
                        Jobs, proofs, and invoices.
                      </span>
                    </Link>
                    <Link
                      href="/portal/designs"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">Your designs</span>
                      <span className="block text-xs text-text-secondary mt-1">
                        Reopen artwork in the studio.
                      </span>
                    </Link>
                    <Link
                      href="/account/team"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">Team store</span>
                      <span className="block text-xs text-text-secondary mt-1">
                        Create or invite people to a branded store.
                      </span>
                    </Link>
                    <div className="border-t border-border my-1" />
                    <SignOutButton className="block w-full text-left rounded-sm px-3 py-3 text-sm font-bold hover:bg-fill-subtle-15 transition-colors" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="relative hidden sm:block"
              onMouseEnter={openAccount}
              onMouseLeave={scheduleAccountClose}
            >
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
                className="inline-flex items-center px-3.5 py-2 text-sm font-bold rounded-md border border-border hover:border-text-tertiary hover:bg-fill-subtle-15 transition-colors"
              >
                Sign In
              </button>
              {accountOpen && (
                <div
                  onMouseEnter={openAccount}
                  onMouseLeave={scheduleAccountClose}
                  className="absolute right-0 top-full pt-2 w-[320px] z-50"
                >
                  <div className="rounded-md border border-border bg-bg-raised shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-2">
                    <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-tertiary m-0">
                      Sign In
                    </p>
                    <Link
                      href="/account"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">Personal Login</span>
                      <span className="block text-xs text-text-secondary mt-1">
                        For individual customers and small orders.
                      </span>
                    </Link>
                    <Link
                      href="/start"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">
                        Corporate &amp; Institutional
                      </span>
                      <span className="block text-xs text-text-secondary mt-1">
                        Bulk-order accounts and branded team stores.
                      </span>
                    </Link>
                    <Link
                      href="/admin/login"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">Staff Login</span>
                      <span className="block text-xs text-text-secondary mt-1">
                        Internal team and production access only.
                      </span>
                    </Link>
                    <div className="border-t border-border my-1" />
                    {/* Read "Continue via Chat — Quick, no password needed",
                        sitting under a Sign In heading beside three real
                        sign-in routes. There is no chat anywhere in the
                        product and this signs nobody in; it opens the contact
                        form, which genuinely does not need an account. */}
                    <Link
                      href="/contact"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-sm px-3 py-3 hover:bg-fill-subtle-15 transition-colors"
                    >
                      <span className="block font-bold text-sm">
                        No account? Send us your project
                      </span>
                      <span className="block text-xs text-text-secondary mt-1">
                        Email the team — no sign-in needed.
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative inline-flex items-center gap-sp-2 px-3.5 py-2 text-sm font-bold rounded-md border border-border hover:border-text-tertiary hover:bg-fill-subtle-15 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Cart</span>
            <span className="absolute -top-2 -right-2 bg-text-primary text-white text-[11px] font-bold min-w-[18px] h-[18px] rounded-full grid place-items-center px-1">
              {pieceCount}
            </span>
          </Link>
          {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
            <ButtonLink
              href="/quote"
              variant="primary"
              size="sm"
              className="hidden md:inline-flex"
            >
              Get a Quote
            </ButtonLink>
          ) : null}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
            className="lg:hidden w-10 h-10 rounded-md border border-border grid place-items-center hover:bg-fill-subtle-15 transition-colors"
          >
            <span className="sr-only">Menu</span>
            <span className="flex flex-col gap-1.5">
              <span className="block w-5 h-0.5 bg-text-primary" />
              <span className="block w-5 h-0.5 bg-text-primary" />
              <span className="block w-5 h-0.5 bg-text-primary" />
            </span>
          </button>
        </div>
      </Container>

      {mobileOpen && (
        <nav
          className="lg:hidden border-t border-border bg-bg px-sp-4 py-sp-4 max-h-[calc(100svh-var(--header-offset))] overflow-y-auto overscroll-contain"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-1 mb-sp-3">
            {HAS_CATEGORIES
              ? CATEGORY_TREE.map((cat) => (
                  <div
                    key={cat.id}
                    className="border border-border rounded-md bg-bg-raised overflow-hidden"
                  >
                    <Link
                      href={`/products?category=${encodeURIComponent(cat.slug)}`}
                      onClick={() => setMobileOpen(false)}
                      className="block px-3 py-2.5 text-sm font-bold"
                    >
                      {cat.name}
                    </Link>
                    {cat.children.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-2.5">
                        {cat.children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/products?category=${encodeURIComponent(child.slug)}`}
                            onClick={() => setMobileOpen(false)}
                            className="text-xs text-text-secondary"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              : FALLBACK_CATEGORIES.map((cat) => (
                  <Link
                    key={cat.label}
                    href={cat.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md border border-border bg-bg-raised px-3 py-2.5 text-sm font-semibold"
                  >
                    {cat.label}
                  </Link>
                ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-sp-3">
            <Link
              href="/products"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              All Products
            </Link>
            <Link
              href="/design"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              AI Design Studio
            </Link>
            <Link
              href="/services"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              Services
            </Link>
            <Link
              href="/locations"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              Locations
            </Link>
            {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
              <Link
                href="/quote"
                onClick={() => setMobileOpen(false)}
                className="text-sm font-bold px-3 py-2 text-accent"
              >
                Get a Quote
              </Link>
            ) : null}
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              About
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              Contact
            </Link>
            {customerName ? (
              <>
                <Link
                  href="/portal"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold px-3 py-2"
                >
                  Customer portal
                </Link>
                <Link
                  href="/portal/jobs"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold px-3 py-2"
                >
                  Your orders
                </Link>
                <Link
                  href="/portal/designs"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold px-3 py-2"
                >
                  Your designs
                </Link>
                <Link
                  href="/account/team"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold px-3 py-2"
                >
                  Team store
                </Link>
                <SignOutButton className="text-sm font-bold px-3 py-2 text-left" />
              </>
            ) : (
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="text-sm font-bold px-3 py-2"
              >
                Sign In
              </Link>
            )}
            <Link
              href="/admin/login"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2 text-text-tertiary"
            >
              Staff
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}