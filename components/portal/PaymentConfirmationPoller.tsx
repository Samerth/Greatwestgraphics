"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 20; // ~80s of polling — comfortably past Stripe's usual settle time

/**
 * Replaces the old static "your payment is confirming" text. That banner
 * never actually updated itself: this page is a Server Component with no
 * client-side refresh of any kind, so a customer who stayed on the tab
 * Stripe redirected them to saw "confirming" forever, until they reloaded
 * by hand — the page's own former comment admitted as much ("the banner is
 * cosmetic only").
 *
 * This calls router.refresh() every few seconds, which re-runs the page's
 * server data fetch (a fresh read of the job's real status from the
 * database) without a full navigation or losing any other client state on
 * the page. The parent then re-renders with `active` false the moment the
 * job is actually paid, at which point this unmounts itself — nothing here
 * decides "paid"; it only asks the server again until the server's own
 * answer changes.
 *
 * Gives up after MAX_POLLS rather than polling indefinitely if a webhook
 * never lands (a failed delivery, a misconfigured endpoint) — silence past
 * that point would look identical to "still working," so the message
 * changes instead of continuing to imply it will resolve any second.
 */
export function PaymentConfirmationPoller({ active }: { active: boolean }) {
  const router = useRouter();
  const pollsRef = useRef(0);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!active) return;
    pollsRef.current = 0;
    setGaveUp(false);
    const timer = setInterval(() => {
      pollsRef.current += 1;
      if (pollsRef.current > MAX_POLLS) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  if (!active) return null;

  return (
    <p
      role="status"
      className="text-sm border border-border rounded-md p-sp-3 bg-fill-subtle-15"
    >
      {gaveUp
        ? "Your payment is taking longer than usual to confirm. It may still go through — check back in a few minutes, or contact us if this page doesn't update."
        : "Thanks — your card payment is confirming. This page updates automatically, usually within a minute."}
    </p>
  );
}
