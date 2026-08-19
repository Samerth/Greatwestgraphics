"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
     
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-sp-3">
      <h1 className="font-display font-bold text-2xl m-0">Something went wrong</h1>
      <p className="text-text-secondary">
        This admin page hit an error. Try again, or navigate elsewhere from the sidebar.
      </p>
      <button
        onClick={reset}
        className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
      >
        Try again
      </button>
    </div>
  );
}
