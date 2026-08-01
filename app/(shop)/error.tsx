"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/shared/Button";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <section className="py-sp-8">
      <Container className="max-w-lg text-center">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Something went wrong
        </span>
        <h1 className="font-display font-bold text-header leading-header mt-sp-2 mb-sp-3">
          This page hit a snag.
        </h1>
        <p className="text-text-secondary mb-sp-5">
          Nothing was lost — your cart and account are unaffected. Try again,
          or head back to the shop.
        </p>
        <div className="flex gap-sp-3 justify-center">
          <Button onClick={reset}>Try again</Button>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2.5 rounded-md border border-border font-bold text-sm hover:bg-fill-subtle-15 transition-colors"
          >
            Back to shop
          </Link>
        </div>
      </Container>
    </section>
  );
}
