"use client";

import { useState } from "react";
import { Field, Input } from "@/components/checkout/FormField";
import { Button } from "@/components/shared/Button";

export function InviteForm({ accountId }: { accountId: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setStatus("sending");
    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, email }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Could not send the invite.");
      }
      setStatus("sent");
      setEmail("");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the invite.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end max-w-md">
      <div className="flex-1">
        <Field label="Invite a teammate by email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="teammate@company.com"
          />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={status === "sending"} className="mb-sp-3">
        {status === "sending" ? "Sending…" : status === "sent" ? "Sent ✓" : "Invite"}
      </Button>
      {error && <p className="text-[13px] text-red-600 font-semibold">{error}</p>}
    </form>
  );
}
