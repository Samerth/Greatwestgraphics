"use client";

import { useState, useRef, useEffect } from "react";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { useCartStore } from "@/lib/store/cart";
import { ActiveDesignBadge } from "@/components/design/ActiveDesignBadge";
import { SignOutButton } from "@/components/account/SignOutButton";
import type { StorefrontCategory } from "@/lib/commerce/catalog";
import {
  buildCategoryTree,
  buildShopSections,
  SHOP_SERVICES,
  SHOP_INDUSTRIES,
  type CategoryNode,
} from "@/lib/navigation/shop-section";

import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

// Used only when the commerce API returned no categories.
const FALLBACK_CATEGORIES = [{ label: "All Products", href: "/products" }];

const PRIMARY_LINKS = [{ label: "Design Studio", href: "/design" }];

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
  const CATEGORY_TREE: CategoryNode[] =
    categories.length > 0 ? buildCategoryTree(categories) : [];
  const SHOP_SECTIONS =
    categories.length > 0 ? buildShopSections(CATEGORY_TREE) : [];
  const HAS_CATEGORIES = SHOP_SECTIONS.length > 0;

  // The Shop mega menu used to be split by department, one at a time, behind
  // a left-hand rail. It's now a single flat view of every group across
  // every department at once — so "browse everything" really shows
  // everything, with no extra click to switch departments.
  const ALL_GROUPS = SHOP_SECTIONS.flatMap((section) => section.groups);

  // The right rail used to list three shortcuts — Design Studio, Get a
  // Quote, Corporate & Team Stores. The first two already have their own
  // entry points in the header (the "Design Studio" nav link and the "Get a
  // Quote" button), so the rail now surfaces only the one shortcut that
  // doesn't live anywhere else: Corporate & Team Stores.
  const CORPORATE_SERVICE = SHOP_SERVICES.filter((s) =>
    s.label.toLowerCase().includes("corporate"),
  );

  const rawPieceCount = useCartStore((s) => s.pieceCount());
  // Zustand's persist middleware only reads localStorage on the client, so
  // the server always renders an empty cart. Gate the real count behind a
  // post-mount flag so the first client render matches the server's, then
  // update — otherwise React logs a hydration mismatch for any returning
  // visitor who already has items in their cart.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pieceCount = mounted ? rawPieceCount : 0;

  // --- Quick department buttons (Apparel / Headwear & Bags / Workwear &
  // Safety / Eco & Specialty). Each opens a lightweight panel scoped to just
  // that one department.
  const [openDeptId, setOpenDeptId] = useState<string | null>(null);
  const deptCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openDept = (id: string) => {
    if (deptCloseTimer.current) clearTimeout(deptCloseTimer.current);
    setOpenDeptId(id);
  };
  const scheduleDeptClose = () => {
    deptCloseTimer.current = setTimeout(() => setOpenDeptId(null), 120);
  };
  const activeDept = SHOP_SECTIONS.find((s) => s.id === openDeptId);

  // --- The full "Shop" mega menu: every category, everywhere, at once.
  const [shopOpen, setShopOpen] = useState(false);
  const shopCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openShop = () => {
    if (shopCloseTimer.current) clearTimeout(shopCloseTimer.current);
    setShopOpen(true);
  };
  const scheduleShopClose = () => {
    shopCloseTimer.current = setTimeout(() => setShopOpen(false), 120);
  };

  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const openAccount = () => {
    if (accountTimer.current) clearTimeout(accountTimer.current);
    setAccountOpen(true);
  };
  const scheduleAccountClose = () => {
    accountTimer.current = setTimeout(() => setAccountOpen(false), 120);
  };

  return (
    <header className="sticky top-0 z-[60] bg-bg-90 backdrop-blur-lg border-b border-border">
      <Container className="h-[88px] flex items-center justify-between gap-sp-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {storeName ? (
            storeLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeLogoUrl}
                alt={storeName}
                className="h-12 w-auto max-w-[220px] object-contain"
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
              className="h-14 sm:h-16 w-auto"
            />
          )}
        </Link>

        {/* Primary nav */}
        <nav className="hidden lg:flex items-center gap-sp-4 xl:gap-sp-5">
          {HAS_CATEGORIES &&
            SHOP_SECTIONS.map((section) => (
              <NavTrigger
                key={section.id}
                label={section.label}
                isOpen={openDeptId === section.id}
                onToggle={() =>
                  setOpenDeptId((v) => (v === section.id ? null : section.id))
                }
                onMouseEnter={() => openDept(section.id)}
                onMouseLeave={scheduleDeptClose}
              />
            ))}

          <NavTrigger
            label="Shop"
            isOpen={shopOpen}
            onToggle={() => setShopOpen((v) => !v)}
            onMouseEnter={openShop}
            onMouseLeave={scheduleShopClose}
          />

          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="relative whitespace-nowrap font-bold text-sm text-text-primary py-1 group"
            >
              {link.label}
              <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-accent scale-x-0 origin-left transition-transform duration-med group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        {/* Quick department panel — single department, no sidebar, no rail */}
        {activeDept && (
          <div
            onMouseEnter={() => openDept(activeDept.id)}
            onMouseLeave={scheduleDeptClose}
            className="fixed left-0 right-0 top-[88px] px-sp-4"
          >
            <div className="mx-auto w-full max-w-[1100px] rounded-xl border border-border bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.16)] overflow-hidden">
              <div className="p-sp-5 max-h-[72vh] overflow-y-auto">
                <div className="mb-sp-4">
                  <h3 className="m-0 font-display font-bold text-lg text-text-primary">
                    {activeDept.label}
                  </h3>
                  <p className="m-0 mt-1 text-xs text-text-secondary">
                    {activeDept.blurb}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-x-sp-5 gap-y-sp-5">
                  {activeDept.groups.map((group) => (
                    <CategoryGroupBlock
                      key={group.id}
                      group={group}
                      onNavigate={() => setOpenDeptId(null)}
                    />
                  ))}
                </div>
              </div>
              <div className="px-sp-5 py-sp-3 border-t border-border bg-bg-raised flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  Not sure what you need?
                </span>
                <Link
                  href="/products"
                  onClick={() => setOpenDeptId(null)}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  View all products →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Shop mega menu — every category, every department, in one flat
            view. The right rail is trimmed to just Corporate & Team Stores. */}
        {shopOpen && (
          <div
            onMouseEnter={openShop}
            onMouseLeave={scheduleShopClose}
            className="fixed left-0 right-0 top-[88px] px-sp-4"
          >
            <div className="mx-auto w-full max-w-[1180px] rounded-xl border border-border bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.16)] overflow-hidden">
              {HAS_CATEGORIES ? (
                <div className="flex max-h-[72vh]">
                  <div className="flex-1 min-w-0 p-sp-5 overflow-y-auto">
                    <div className="mb-sp-4">
                      <h3 className="m-0 font-display font-bold text-lg text-text-primary">
                        Shop All Categories
                      </h3>
                      <p className="m-0 mt-1 text-xs text-text-secondary">
                        Every product line we print and embroider, all in one place.
                      </p>
                    </div>
                    <div className="columns-1 sm:columns-2 xl:columns-3 gap-x-sp-5">
                      {ALL_GROUPS.map((group) => (
                        <div key={group.id} className="break-inside-avoid mb-sp-5">
                          <CategoryGroupBlock
                            group={group}
                            onNavigate={() => setShopOpen(false)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Services rail — trimmed to just Corporate & Team Stores */}
                  {CORPORATE_SERVICE.length > 0 && (
                    <div className="hidden xl:flex w-[276px] shrink-0 flex-col gap-sp-2 border-l border-border bg-bg-raised p-sp-4">
                      {CORPORATE_SERVICE.map((service) => (
                        <Link
                          key={service.label}
                          href={service.href}
                          onClick={() => setShopOpen(false)}
                          className="block rounded-lg border border-border bg-bg px-3.5 py-3.5 hover:border-accent transition-colors"
                        >
                          <span className="block font-bold text-sm">{service.label}</span>
                          <span className="block text-xs text-text-secondary mt-1">
                            {service.hint}
                          </span>
                        </Link>
                      ))}
                      <Link
                        href="/contact"
                        onClick={() => setShopOpen(false)}
                        className="mt-auto block rounded-lg px-3.5 py-3 text-center text-xs font-bold text-text-secondary hover:text-accent transition-colors"
                      >
                        Need help? Contact the team →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-sp-5 grid grid-cols-2 gap-x-sp-4 gap-y-1">
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

              <div className="px-sp-5 py-sp-3 border-t border-border bg-bg-raised flex items-center justify-between">
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
            aria-label={`Cart, ${pieceCount} item${pieceCount === 1 ? "" : "s"}`}
            className="relative inline-flex items-center gap-sp-2 px-3 sm:px-3.5 py-2 text-sm font-bold rounded-md border border-border hover:border-text-tertiary hover:bg-fill-subtle-15 transition-colors"
          >
            <ShoppingBag size={18} strokeWidth={2} aria-hidden className="shrink-0" />
            <span className="hidden sm:inline">Cart</span>
            {pieceCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-text-primary text-white text-[11px] font-bold min-w-[18px] h-[18px] rounded-full grid place-items-center px-1">
                {pieceCount}
              </span>
            )}
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
          <div className="flex flex-col gap-1.5 mb-sp-3">
            {HAS_CATEGORIES
              ? SHOP_SECTIONS.map((section) => {
                  const open = openMobileSection === section.id;
                  return (
                    <div
                      key={section.id}
                      className="border border-border rounded-md bg-bg-raised overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMobileSection(open ? null : section.id)
                        }
                        aria-expanded={open}
                        className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left"
                      >
                        <span className="min-w-0 truncate text-sm font-bold">
                          {section.label}
                        </span>
                        <span
                          aria-hidden
                          className={`shrink-0 text-xs text-text-tertiary transition-transform duration-med ${
                            open ? "rotate-180" : ""
                          }`}
                        >
                          ▾
                        </span>
                      </button>
                      {open && (
                        <div className="border-t border-border px-3 py-2.5 space-y-sp-3">
                          {section.groups.map((group) => (
                            <div key={group.id}>
                              <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
                                {group.label}
                              </p>
                              <div className="space-y-1.5">
                                {group.categories.map((cat) => (
                                  <div key={cat.id}>
                                    <Link
                                      href={cat.href}
                                      onClick={() => setMobileOpen(false)}
                                      className={`text-xs font-semibold text-text-primary ${cat.isLive ? "" : "opacity-60"}`}
                                    >
                                      {cat.name}
                                    </Link>
                                    {cat.children.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-2 border-l border-border">
                                        {cat.children.map((child) => (
                                          <Link
                                            key={child.id}
                                            href={child.href}
                                            onClick={() => setMobileOpen(false)}
                                            className={`text-[11px] text-text-secondary ${child.isLive ? "" : "opacity-60"}`}
                                          >
                                            {child.name}
                                          </Link>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
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
              Design Studio
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

/** Shared trigger for every header dropdown (departments + Shop) so the
 * label/arrow can never render inconsistently between buttons the way a
 * one-off, duplicated version of this markup could. */
function NavTrigger({
  label,
  isOpen,
  onToggle,
  onMouseEnter,
  onMouseLeave,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="relative flex items-center gap-1.5 whitespace-nowrap font-bold text-sm text-text-primary py-1 group"
      >
        <span>{label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 8"
          fill="none"
          className={`shrink-0 transition-transform duration-med ${
            isOpen ? "rotate-180" : ""
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
    </div>
  );
}

type CategoryGroup = ReturnType<typeof buildShopSections>[number]["groups"][number];
type ShopNodeView = CategoryGroup["categories"][number];

/** One category group column: the taxonomy category as a heading, then its
 * subcategories, then any third-level entries. Entries that exist in the
 * taxonomy but not yet in the synced catalogue render muted, so the menu
 * mirrors the taxonomy without pretending every leaf has inventory. */
function CategoryGroupBlock({
  group,
  onNavigate,
}: {
  group: CategoryGroup;
  onNavigate: () => void;
}) {
  return (
    <div className="min-w-0">
      <p className="m-0 mb-2 pb-1.5 border-b border-border text-[11px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        {group.href ? (
          <Link href={group.href} onClick={onNavigate} className="hover:text-accent transition-colors">
            {group.label}
          </Link>
        ) : (
          group.label
        )}
      </p>
      <ul className="m-0 p-0 list-none space-y-2.5">
        {group.categories.map((cat) => (
          <ShopNodeItem key={cat.id} node={cat} depth={0} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

function ShopNodeItem({
  node,
  depth,
  onNavigate,
}: {
  node: ShopNodeView;
  depth: number;
  onNavigate: () => void;
}) {
  const tone =
    depth === 0
      ? "text-sm font-bold text-text-primary"
      : "text-xs text-text-secondary";
  return (
    <li className="min-w-0">
      <Link
        href={node.href}
        onClick={onNavigate}
        className={`block ${tone} ${node.isLive ? "" : "opacity-60"} hover:text-accent transition-colors`}
      >
        {node.name}
      </Link>
      {node.children.length > 0 && (
        <ul className="mt-1 m-0 p-0 list-none space-y-1 pl-2 border-l border-border">
          {node.children.map((child) => (
            <ShopNodeItem key={child.id} node={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}
