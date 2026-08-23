"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Backup for `/start` and `/start/pending`: if the server-rendered page is
 * stale, send an owner to the right place from the browser.
 *
 * `live-store` is for the pending page — only leave once staff have approved
 * and the destination is `/s/{slug}`. Polling keeps that page honest while
 * they wait instead of asking them to refresh.
 */
export function RedirectIfExistingStore({
  when = "any-team",
  pollMs,
}: {
  when?: "any-team" | "live-store";
  pollMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch("/api/stores/mine", { cache: "no-store" });
        const payload = (await response.json()) as { destination?: string | null };
        if (cancelled || !payload.destination) return;
        if (when === "live-store" && !payload.destination.startsWith("/s/")) {
          return;
        }
        router.replace(payload.destination);
      } catch {
        // Stay put — first-time owners still need the wizard, and a failed
        // lookup must not bounce someone off the pending page.
      }
    }

    void check();
    if (!pollMs) return () => {
      cancelled = true;
    };
    const timer = setInterval(() => void check(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router, when, pollMs]);

  return null;
}
