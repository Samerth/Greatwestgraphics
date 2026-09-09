"use client";

import { useState, useRef, useEffect } from "react";
import { ShoppingBag, UserRound, PenTool, Headphones } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/shared/Container";
import { cn } from "@/lib/utils/cn";
import { useCartStore } from "@/lib/store/cart";
import { ActiveDesignBadge } from "@/components/design/ActiveDesignBadge";
import { HeaderSearchBar, HeaderSearchMobile } from "@/components/layout/HeaderSearch";
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

/** One promotional tile per department, shown beside the category columns in
 * the dropdown — the mockup's own mega-menu treatment. Images are ones
 * already used elsewhere for these exact departments (CategoryBrowse.tsx),
 * not new assets, so nothing here is invented. */
const DEPARTMENT_PROMO: Record<string, { image: string; label: string; href: string }> = {
  apparel: { image: "/images/prod-tee.jpg", label: "Shop apparel best sellers", href: "/products?category=best-sellers" },
  "promotional-products": { image: "/images/prod-tote.jpg", label: "Shop promo best sellers", href: "/products?category=best-sellers" },
  "signs-displays": { image: "/images/category-outdoor.jpg", label: "Shop signs & displays", href: "/products?category=best-sellers" },
  "print-products": { image: "/images/category-more.jpg", label: "Shop print products", href: "/products?category=best-sellers" },
};

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
  const deptPinnedRef = useRef(false);
  const openDept = (id: string) => {
    if (deptCloseTimer.current) clearTimeout(deptCloseTimer.current);
    setOpenDeptId(id);
  };
  const openDeptViaClick = (id: string) => {
    if (deptCloseTimer.current) clearTimeout(deptCloseTimer.current);
    deptPinnedRef.current = true;
    setOpenDeptId((prev) => (prev === id ? null : id));
  };
  const scheduleDeptClose = () => {
    if (deptPinnedRef.current) return;
    deptCloseTimer.current = setTimeout(() => setOpenDeptId(null), 120);
  };
  const unpinDept = () => {
    deptPinnedRef.current = false;
  };
  const activeDept = SHOP_SECTIONS.find((s) => s.id === openDeptId);

  // --- The full "Shop" mega menu: every category, everywhere, at once.
  const [shopOpen, setShopOpen] = useState(false);
  const shopCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shopPinnedRef = useRef(false);
  const openShop = () => {
    if (shopCloseTimer.current) clearTimeout(shopCloseTimer.current);
    setShopOpen(true);
  };
  const openShopViaClick = () => {
    if (shopCloseTimer.current) clearTimeout(shopCloseTimer.current);
    shopPinnedRef.current = true;
    setShopOpen((prev) => !prev);
  };
  const scheduleShopClose = () => {
    if (shopPinnedRef.current) return;
    shopCloseTimer.current = setTimeout(() => setShopOpen(false), 120);
  };
  const unpinShop = () => {
    shopPinnedRef.current = false;
  };
  const closeDept = () => {
    setOpenDeptId(null);
    deptPinnedRef.current = false;
  };
  const closeShop = () => {
    setShopOpen(false);
    shopPinnedRef.current = false;
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

  // Close any open desktop dropdown (department panel, Shop mega menu,
  // account menu) on an outside click or Escape. Mobile nav is deliberately
  // excluded — it has its own hamburger toggle and shouldn't snap shut from
  // taps inside it.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function closeAll() {
      setOpenDeptId(null);
      setShopOpen(false);
      setAccountOpen(false);
      deptPinnedRef.current = false;
      shopPinnedRef.current = false;
    }
    function handleClickOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        closeAll();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Drives the shadow on the sticky header. Passive listener, and it only
  // writes state when the boolean actually flips, so scrolling doesn't
  // re-render the header on every frame.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 8;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={headerRef}
      data-scrolled={scrolled ? "true" : undefined}
      // Height is fixed by the UAT doc (96px logo/search/actions row + a 64px
      // nav row = 160px, recorded as delivered and accepted), so this
      // deliberately does not shrink on scroll. It only gains a shadow once
      // the page moves — previously it looked identical at the top of the
      // page and three thousand pixels down.
      //
      // Structure follows the client-approved mockup's three tiers
      // (announcement bar — TickBar, rendered by the layout above this —
      // then logo/search/actions, then nav/CTA) rather than the single row
      // this used to be. The search bar was a separate 64px band below the
      // whole thing before; it now lives in the same row as the logo, which
      // is both what the mockup does and satisfies the UAT ask for search
      // "in or directly below the main navigation".
      className="sticky top-0 z-[60] bg-bg-90 backdrop-blur-lg border-b border-border transition-shadow duration-med ease-out-custom data-[scrolled]:shadow-card"
    >
      <Container className="h-[96px] flex items-center gap-sp-4">
        {/* Logo — size is fixed by the UAT doc ("enlarge the logo about
            15–25%, it's currently getting lost"), so this stays put even
            though the mockup's own logo reads smaller. */}
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
              className="h-16 sm:h-20 w-auto"
            />
          )}
        </Link>

        <div className="hidden lg:flex flex-1 justify-center min-w-0 px-sp-3">
          <HeaderSearchBar />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-sp-2 shrink-0 ml-auto lg:ml-0">
          <ActiveDesignBadge />
          {/* Was an icon-only circle — easy to mistake for decoration rather
              than a control, which is exactly what got flagged ("help icon
              is not there"). The mockup's own header labels Help/Account/Cart
              with text under the icon rather than relying on the icon alone;
              matched that here for all three triggers. */}
          <Link
            href="/faq"
            title="Help"
            aria-label="Help"
            className="hidden sm:flex flex-col items-center gap-1 px-1.5 py-1 rounded-md text-text-primary hover:text-accent transition-colors"
          >
            <Headphones size={20} strokeWidth={2} aria-hidden />
            <span className="text-[11px] font-bold leading-none">Help</span>
          </Link>
          {customerName ? (
            <div
              className="relative hidden sm:block"
              onMouseEnter={openAccount}
              onMouseLeave={scheduleAccountClose}
            >
              <Link
                href="/portal"
                onMouseEnter={openAccount}
                aria-label="Your account"
                title="Your account"
                className="hidden sm:flex flex-col items-center gap-1 px-1.5 py-1 rounded-md text-text-primary hover:text-accent transition-colors"
              >
                <UserRound size={20} strokeWidth={2} aria-hidden />
                <span className="text-[11px] font-bold leading-none">Account</span>
              </Link>
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
            <Link
              href="/account"
              aria-label="Sign in"
              title="Sign in"
              className="hidden sm:flex flex-col items-center gap-1 px-1.5 py-1 rounded-md text-text-primary hover:text-accent transition-colors"
            >
              <UserRound size={20} strokeWidth={2} aria-hidden />
              <span className="text-[11px] font-bold leading-none">Account</span>
            </Link>
          )}
          <Link
            href="/cart"
            aria-label={`Cart, ${pieceCount} item${pieceCount === 1 ? "" : "s"}`}
            title="Cart"
            // Icon-only below `sm` (mobile header is tight enough already
            // between search icon and the hamburger); icon + label to match
            // Help/Account from `sm` up.
            className="flex flex-col items-center gap-1 px-1.5 py-1 rounded-md text-text-primary hover:text-accent transition-colors"
          >
            <span className="relative">
              <ShoppingBag size={20} strokeWidth={2} aria-hidden className="shrink-0" />
              {pieceCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-accent text-white text-[11px] font-bold min-w-[19px] h-[19px] rounded-full grid place-items-center px-1 ring-2 ring-bg tabular-nums">
                  {pieceCount}
                </span>
              )}
            </span>
            <span className="hidden sm:block text-[11px] font-bold leading-none">Cart</span>
          </Link>
          <HeaderSearchMobile />
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

      {/* Nav row — the mockup's third tier: category links on the left, a
          single persistent CTA on the right. The "Get an Instant Quote" link
          points to the /quote calculator. */}
      <div className="hidden lg:block border-t border-border/70">
        <Container className="h-16 flex items-center justify-between gap-sp-4">
          <nav
            // Was a flat 12px gap — measured as visibly tighter than the
            // mockup's own nav row (30px between items) and the reason the
            // row read as "compact" even after the container widened in an
            // earlier round. Re-measured the actual slack in this row before
            // widening it: at the narrowest width this row renders at (1024px,
            // 6 items visible), there is ~286px of dead space between the last
            // nav item and the "Get an instant quote" link — room to more than
            // double the gap with margin to spare. Re-verified after the
            // change that nothing drops out at 1024/1280/1440/1920.
            //
            // `overflow-hidden` only stops a spill; it is not the sizing
            // strategy. Department labels come from the database, so if a very
            // long one is ever added, re-check the budget below rather than
            // letting it quietly disappear again.
            className="flex items-center gap-sp-4 min-w-0 overflow-hidden"
          >
            <Link
              href="/products?category=best-sellers"
              className="relative whitespace-nowrap font-bold text-sm text-text-primary py-1 group"
            >
              Best Sellers
              <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-accent scale-x-0 origin-left transition-transform duration-med group-hover:scale-x-100" />
            </Link>

            {/* Measured, not guessed. The nav track is 812px; the full set of
                eight items needs 1004px (836 of item plus 168 of gap), so the
                tail used to be clipped inside a hidden-scrollbar overflow
                container — present in the DOM, unreachable with a mouse.

                At a 12px gap everything except the last department fits in 800px
                of the 812 available, so only that one drops out on desktop, and
                two more step aside between 1024 and 1279 where the track narrows
                to ~684px. The last section is the catch-all ("Also in the
                Catalogue"), and whatever is hidden at any width is still one
                click away in the "Shop" menu beside it, which lists every group
                in every department.

                800 of 812 is a real but deliberate margin: it is what buys four
                visible departments instead of two. If a longer department name
                is added, the honest fix is to move another one behind `xl`, not
                to shrink the type. */}
            {HAS_CATEGORIES &&
              SHOP_SECTIONS.map((section, i) => (
                <NavTrigger
                  key={section.id}
                  label={section.label}
                  className={
                    i <= 1
                      ? undefined
                      : i <= 3
                        ? "hidden xl:flex"
                        : "hidden"
                  }
                  isOpen={openDeptId === section.id}
                  onToggle={() => openDeptViaClick(section.id)}
                  onMouseEnter={() => openDept(section.id)}
                  onMouseLeave={scheduleDeptClose}
                />
              ))}

            <NavTrigger
              label="Shop"
              isOpen={shopOpen}
              onToggle={openShopViaClick}
              onMouseEnter={openShop}
              onMouseLeave={scheduleShopClose}
            />

            {/* No dedicated Brands page exists — the catalogue's Brand
                filter already covers this, so this points at the same place
                rather than a landing page that doesn't exist yet. */}
            <Link
              href="/products"
              className="relative whitespace-nowrap font-bold text-sm text-text-primary py-1 group"
            >
              Brands
              <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-accent scale-x-0 origin-left transition-transform duration-med group-hover:scale-x-100" />
            </Link>

            {/* Everything to the left of this is a place to browse. The Design
                Studio is the one thing in the nav you *do* rather than look at,
                so it is shaped like an action — a tinted pill with a tool icon —
                instead of being a category link that happens to be last. The
                pen nib nudges on hover; the whole pill fills on hover so it
                still reads as one target rather than a decorated word. */}
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/25 bg-accent-tint px-3 py-1.5 text-sm font-bold text-accent transition-[background-color,border-color,color] duration-med ease-out-custom hover:bg-accent hover:border-accent hover:text-white"
              >
                <PenTool
                  size={15}
                  strokeWidth={2.25}
                  aria-hidden
                  className="shrink-0 transition-transform duration-med ease-out-custom group-hover:-rotate-12"
                />
                {link.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/quote"
            className="group inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-sm text-accent shrink-0"
          >
            Get an instant quote
            <span
              aria-hidden
              className="transition-transform duration-med ease-out-custom group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </Container>
      </div>

      {/* Quick department panel — single department, no sidebar, no rail.
          Previously a floating, rounded, shadowed card centred with side
          margins — the mockup's own dropdown is full-width and sits flush
          under the header, reading as an extension of it rather than a
          popover on top of the page. Same content, restructured container:
          `<Container>` instead of a max-width card, no rounded corners on a
          full-bleed element, a single bottom border/shadow doing the
          separation instead of a border-all-around card. */}
        {activeDept && (
          <div
            onMouseEnter={() => {
              unpinDept();
              openDept(activeDept.id);
            }}
            onMouseLeave={scheduleDeptClose}
            className="absolute left-0 right-0 top-full bg-bg border-b border-border shadow-[0_16px_40px_rgba(20,26,35,0.08)]"
          >
            <Container>
              <div className="py-sp-5 max-h-[70vh] overflow-y-auto grid grid-cols-[1fr_260px] gap-sp-6">
                <div>
                  <div className="mb-sp-4">
                    <h3 className="m-0 font-display font-bold text-lg text-text-primary">
                      {activeDept.label}
                    </h3>
                    <p className="m-0 mt-1 text-xs text-text-secondary">
                      {activeDept.blurb}
                    </p>
                  </div>
                  <div className="columns-2 lg:columns-4 gap-x-sp-5">
                    {activeDept.groups.map((group) => (
                      <div key={group.id} className="break-inside-avoid mb-sp-5">
                        <CategoryGroupBlock group={group} onNavigate={closeDept} />
                      </div>
                    ))}
                  </div>
                </div>
                <DepartmentPromoTile deptId={activeDept.id} onNavigate={closeDept} />
              </div>
            </Container>
            <div className="border-t border-border bg-bg-raised">
              <Container className="py-sp-3 flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  Not sure what you need?
                </span>
                <Link
                  href="/products"
                  onClick={closeDept}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  View all products →
                </Link>
              </Container>
            </div>
          </div>
        )}

        {/* Shop mega menu — every category, every department, in one flat
            view. Same full-width treatment as the single-department panel
            above, for the same reason. The right rail is trimmed to just
            Corporate & Team Stores. */}
        {shopOpen && (
          <div
            onMouseEnter={() => {
              unpinShop();
              openShop();
            }}
            onMouseLeave={scheduleShopClose}
            className="absolute left-0 right-0 top-full bg-bg border-b border-border shadow-[0_16px_40px_rgba(20,26,35,0.08)]"
          >
            <Container>
              {HAS_CATEGORIES ? (
                <div className="flex max-h-[70vh]">
                  <div className="flex-1 min-w-0 py-sp-5 pr-sp-5 overflow-y-auto">
                    <div className="mb-sp-4">
                      <h3 className="m-0 font-display font-bold text-lg text-text-primary">
                        Shop All Categories
                      </h3>
                      <p className="m-0 mt-1 text-xs text-text-secondary">
                        Every product line we print and embroider, all in one place.
                      </p>
                    </div>
                    <div className="columns-1 sm:columns-2 xl:columns-4 gap-x-sp-5">
                      {ALL_GROUPS.map((group) => (
                        <div key={group.id} className="break-inside-avoid mb-sp-5">
                          <CategoryGroupBlock
                            group={group}
                            onNavigate={closeShop}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Services rail — trimmed to just Corporate & Team Stores */}
                  {CORPORATE_SERVICE.length > 0 && (
                    <div className="hidden xl:flex w-[276px] shrink-0 flex-col gap-sp-2 border-l border-border bg-bg-raised py-sp-5 px-sp-4">
                      {CORPORATE_SERVICE.map((service) => (
                        <Link
                          key={service.label}
                          href={service.href}
                          onClick={closeShop}
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
                        onClick={closeShop}
                        className="mt-auto block rounded-lg px-3.5 py-3 text-center text-xs font-bold text-text-secondary hover:text-accent transition-colors"
                      >
                        Need help? Contact the team →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-sp-5 grid grid-cols-2 gap-x-sp-4 gap-y-1">
                  {FALLBACK_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.label}
                      href={cat.href}
                      onClick={closeShop}
                      className="rounded-md px-3 py-2.5 text-sm font-semibold text-text-primary hover:bg-fill-subtle-15 hover:text-accent transition-colors"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              )}
            </Container>
            <div className="border-t border-border bg-bg-raised">
              <Container className="py-sp-3 flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  Not sure what you need?
                </span>
                <Link
                  href="/products"
                  onClick={closeShop}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  View all products →
                </Link>
              </Container>
            </div>
          </div>
        )}

      {mobileOpen && (
        <nav
          className="lg:hidden border-t border-border bg-bg px-sp-4 py-sp-4 max-h-[calc(100svh-var(--header-offset))] overflow-y-auto overscroll-contain"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-1.5 mb-sp-3">
            <Link
              href="/products?category=best-sellers"
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-border bg-bg-raised px-3 py-2.5 text-sm font-bold"
            >
              Best Sellers
            </Link>
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

          {/* Public navigation links - always visible */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-sp-3">
            {/* Mirrors the desktop nav row's CTA — that row is hidden below
                lg, so mobile needs its own way to reach it. */}
            <Link
              href="/quote"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2 text-accent"
            >
              Get an instant quote →
            </Link>
            <Link
              href="/products"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              All Products
            </Link>
            {/* No dedicated Brands page — points at the catalogue, same as
                the desktop nav's Brands link. */}
            <Link
              href="/products"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              Brands
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
            <Link
              href="/faq"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              Help
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
          </div>

          {/* Auth section - shows different items based on login state */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-sp-3 mt-sp-3">
            {customerName !== null && customerName !== undefined && customerName !== "" ? (
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
              <>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold px-3 py-2"
                >
                  Sign In
                </Link>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-bold px-3 py-2"
                >
                  Create Account
                </Link>
              </>
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
  className,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Lets the nav reveal departments by available width. */
  className?: string;
}) {
  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
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

/** The image tile beside a dropdown's category columns — the mockup's own
 * mega-menu treatment. Renders nothing for a department with no mapped
 * promo (rather than a broken/placeholder tile), so an unmapped department
 * degrades to exactly what the panel looked like before this existed. */
function DepartmentPromoTile({
  deptId,
  onNavigate,
}: {
  deptId: string;
  onNavigate: () => void;
}) {
  const promo = DEPARTMENT_PROMO[deptId];
  if (!promo) return null;
  return (
    <Link
      href={promo.href}
      onClick={onNavigate}
      className="group hidden lg:block shrink-0 self-start rounded-lg overflow-hidden border border-border"
    >
      <div className="relative aspect-[4/3] bg-fill-subtle-15">
        <Image
          src={promo.image}
          alt=""
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          sizes="260px"
        />
      </div>
      <div className="p-sp-3 flex items-center justify-between gap-2 bg-bg-raised">
        <span className="text-sm font-bold text-text-primary">{promo.label}</span>
        <span
          aria-hidden
          className="text-accent transition-transform duration-med ease-out-custom group-hover:translate-x-0.5"
        >
          →
        </span>
      </div>
    </Link>
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
  // Was font-bold + near-black at depth 0 — every link in the menu read at
  // the same heavy weight as the group headings above it, which is most of
  // why the panel felt dense/boxed next to the mockup's regular-weight,
  // lightly tinted links. Weight now differentiates the taxonomy's real
  // depth; the group heading is still the only bold text in a column.
  const tone =
    depth === 0
      ? "text-sm text-text-secondary"
      : "text-xs text-text-tertiary";
  return (
    <li className="min-w-0">
      <Link
        href={node.href}
        onClick={onNavigate}
        className={`block leading-relaxed ${tone} ${node.isLive ? "" : "opacity-60"} hover:text-accent transition-colors`}
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
