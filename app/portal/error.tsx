"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PortalError({
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
    <div className="py-sp-8 px-sp-4 max-w-lg mx-auto text-center">
      <h1 className="font-display font-bold text-2xl m-0 mb-sp-3">Something went wrong</h1>
      <p className="text-text-secondary mb-sp-5">
        This page hit an error. Try again, or head back to your jobs.
      </p>
      <div className="flex gap-sp-3 justify-center">
        <button
          onClick={reset}
          className="bg-accent text-white font-bold px-4 py-2.5 rounded-sm"
        >
          Try again
        </button>
        <Link
          href="/portal/jobs"
          className="border border-border font-bold px-4 py-2.5 rounded-sm hover:bg-fill-subtle-15 transition-colors"
        >
          My jobs
        </Link>
      </div>
    </div>
  );
}
