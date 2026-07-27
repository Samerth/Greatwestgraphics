"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { useCartStore } from "@/lib/store/cart";

const CATEGORIES = [
  { label: "Apparel", href: "/products?category=apparel" },
  { label: "Bags", href: "/products?category=bags" },
  { label: "Hats & Beanies", href: "/products?category=hats-beanies" },
  { label: "Outerwear", href: "/products?category=outerwear" },
  { label: "Polos", href: "/products?category=polos" },
  { label: "Promo", href: "/products?category=promo" },
  { label: "Safety", href: "/products?category=safety" },
  { label: "Signs & Displays", href: "/products?category=signs-displays" },
];

const PRIMARY_LINKS = [
  { label: "Design Studio", href: "/design" },
  { label: "Contact", href: "/contact" },
];

export function Header() {
  const pieceCount = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.qty, 0)
  );

  const [shopOpen, setShopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openShop = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShopOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setShopOpen(false), 120);
  };

  return (
    <header className="sticky top-0 z-[60] bg-bg/90 backdrop-blur-lg border-b border-border">
      <Container className="h-[76px] flex items-center justify-between gap-sp-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/images/logo.png"
            alt="Great West Graphics"
            width={160}
            height={40}
            priority
            className="h-9 w-auto"
          />
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
                className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[560px]"
              >
                <div className="rounded-xl border border-border bg-bg shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-sp-4">
                  <div className="grid grid-cols-2 gap-x-sp-4 gap-y-1">
                    {CATEGORIES.map((cat) => (
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
          <ButtonLink
            href="/quote"
            variant="secondary"
            size="sm"
            className="hidden md:inline-flex"
          >
            Get a Quote
          </ButtonLink>
          <ButtonLink href="/design" variant="primary" size="sm" className="hidden sm:inline-flex">
            Start Designing
          </ButtonLink>
          <Link
            href="/cart"
            className="relative inline-flex items-center gap-sp-2 px-3.5 py-2 text-sm font-bold rounded-md border border-border hover:border-text-tertiary hover:bg-fill-subtle-15 transition-colors"
          >
            <span className="hidden sm:inline">Cart</span>
            <span className="absolute -top-2 -right-2 bg-text-primary text-white text-[11px] font-bold min-w-[18px] h-[18px] rounded-full grid place-items-center px-1">
              {pieceCount}
            </span>
          </Link>
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
        <nav className="lg:hidden border-t border-border bg-bg px-sp-4 py-sp-4">
          <div className="grid grid-cols-2 gap-2 mb-sp-3">
            {CATEGORIES.map((cat) => (
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
              href="/quote"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2 text-accent"
            >
              Get a Quote
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold px-3 py-2"
            >
              Contact
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}