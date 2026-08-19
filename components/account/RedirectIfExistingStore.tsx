"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Backup for `/start`: if the server-rendered wizard still appeared — stale
 * HTML, a failed RSC lookup — send an approved owner to their store from
 * the browser using the same membership check.
 */
export function RedirectIfExistingStore() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/stores/mine", { cache: "no-store" });
        const payload = (await response.json()) as { destination?: string | null };
        if (cancelled || !payload.destination) return;
        router.replace(payload.destination);
      } catch {
        // Stay on the wizard — first-time owners still need it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
