"use client";

import { useState } from "react";
import { Field, Input } from "@/components/checkout/FormField";
import { Button } from "@/components/shared/Button";

type Invitation = { email: string; link: string; emailed: boolean };

export function InviteForm({ accountId }: { accountId: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string>();
  const [invitation, setInvitation] = useState<Invitation>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setInvitation(undefined);
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
      if (payload?.link) {
        setInvitation({
          email,
          link: payload.link,
          emailed: payload.status === "sent",
        });
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
    <div className="max-w-xl">
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

      {invitation && (
        <div className="mt-sp-2 border border-border rounded-md p-sp-3 text-sm">
          <p className="m-0 mb-sp-2">
            {invitation.emailed ? (
              <>
                Invitation emailed to <b>{invitation.email}</b>. If it does not
                arrive, send them this link yourself — it works either way.
              </>
            ) : (
              <>
                The invitation for <b>{invitation.email}</b> is ready, but the
                email could not be sent. Pass this link on and it will still
                work.
              </>
            )}
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 break-all bg-fill-subtle px-2 py-1 rounded text-[12px]">
              {invitation.link}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigator.clipboard?.writeText(invitation.link)}
            >
              Copy
            </Button>
          </div>
          <p className="m-0 mt-sp-2 text-text-tertiary text-[13px]">
            The link expires in 7 days and only works for {invitation.email}.
          </p>
        </div>
      )}
    </div>
  );
}
