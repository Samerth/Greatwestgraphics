"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/Button";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function handleAccept() {
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Could not accept the invite.");
      }
      router.push("/portal/jobs");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept the invite.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Button onClick={handleAccept} disabled={submitting}>
        {submitting ? "Joining…" : "Accept invite"}
      </Button>
      {error && <p className="text-[13px] text-red-600 font-semibold mt-sp-3">{error}</p>}
    </div>
  );
}
