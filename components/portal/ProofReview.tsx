"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/shared/Button";
import {
  decideProofAction,
  type ProofDecisionState,
} from "@/app/portal/jobs/actions";

export interface ProofForReview {
  id: string;
  version: number;
  storageKey: string;
  note: string | null;
  decision: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  awaitingDecisionFrom: string | null;
}

function safeProofUrl(storageKey: string): string | null {
  if (storageKey.startsWith("/")) return storageKey;
  try {
    const url = new URL(storageKey);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function ProofAsset({ proof }: { proof: ProofForReview }) {
  const url = safeProofUrl(proof.storageKey);
  if (!url) {
    return (
      <p role="alert" className="text-sm text-error">
        This proof file is unavailable. Ask our team to upload it again.
      </p>
    );
  }
  const imageLike =
    /\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(url) ||
    url.includes("/api/uploads/");

  return (
    <div className="my-sp-3">
      <a href={url} target="_blank" rel="noreferrer" className="inline-block">
        {imageLike && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={`Proof version ${proof.version}`}
            className="max-h-80 max-w-full object-contain border border-border rounded-sm bg-white"
          />
        )}
        <span className="block text-sm font-bold text-accent mt-1">
          Open proof file ↗
        </span>
      </a>
    </div>
  );
}

function DecidedProof({ proof }: { proof: ProofForReview }) {
  const approved = proof.decision === "approved";
  return (
    <div className="border border-border rounded-md p-sp-3">
      <div className="flex flex-wrap items-center justify-between gap-sp-2">
        <b>Proof v{proof.version}</b>
        <span
          className={`px-3 py-1 rounded-full text-sm font-bold ${
            approved
              ? "bg-accent-tint text-accent"
              : "bg-fill-subtle-15 text-text-secondary"
          }`}
        >
          {approved ? "Approved by you" : "Changes requested"}
        </span>
      </div>
      <ProofAsset proof={proof} />
      {proof.decisionNote && (
        <p className="text-sm text-text-secondary mt-sp-2 mb-0">
          “{proof.decisionNote}”
        </p>
      )}
      {proof.decidedAt && (
        <p className="text-xs text-text-tertiary mt-1 mb-0">
          {new Date(proof.decidedAt).toLocaleString("en-CA")}
        </p>
      )}
    </div>
  );
}

function PendingWithStaff({ proof }: { proof: ProofForReview }) {
  return (
    <div className="border border-border rounded-md p-sp-3">
      <div className="flex flex-wrap items-center justify-between gap-sp-2">
        <b>Proof v{proof.version}</b>
        <span className="bg-fill-subtle-15 text-text-secondary px-3 py-1 rounded-full text-sm font-bold">
          With our team
        </span>
      </div>
      <ProofAsset proof={proof} />
      <p className="text-sm text-text-secondary mt-sp-2 mb-0">
        Our art team is reviewing this. We will send it back for your sign-off.
      </p>
    </div>
  );
}

function ProofDecisionForm({
  jobId,
  proof,
}: {
  jobId: string;
  proof: ProofForReview;
}) {
  const [decision, setDecision] = useState<"approved" | "changes_requested">(
    "approved",
  );
  const [state, formAction, pending] = useActionState<
    ProofDecisionState,
    FormData
  >(decideProofAction.bind(null, jobId, proof.id), {});

  return (
    <form action={formAction} className="border border-border rounded-md p-sp-3">
      <div className="flex flex-wrap items-center justify-between gap-sp-2 mb-sp-3">
        <b>Proof v{proof.version}</b>
        <span className="bg-accent-tint text-accent px-3 py-1 rounded-full text-sm font-bold">
          Awaiting your approval
        </span>
      </div>

      {proof.note && (
        <p className="text-sm text-text-secondary mt-0 mb-sp-3">
          Note from our team: {proof.note}
        </p>
      )}
      <ProofAsset proof={proof} />

      <fieldset className="border-0 p-0 m-0 mb-sp-3">
        <legend className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
          Your response
        </legend>
        <label className="flex items-center gap-2 text-sm mb-1">
          <input
            type="radio"
            name="decision"
            value="approved"
            checked={decision === "approved"}
            onChange={() => setDecision("approved")}
          />
          Approve this proof and move to production
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="decision"
            value="changes_requested"
            checked={decision === "changes_requested"}
            onChange={() => setDecision("changes_requested")}
          />
          Request changes
        </label>
      </fieldset>

      <label className="block text-sm mb-sp-3">
        <span className="text-xs font-bold uppercase tracking-wide text-text-tertiary block mb-1.5">
          {decision === "changes_requested"
            ? "What should we change?"
            : "Anything to add? (optional)"}
        </span>
        <textarea
          name="note"
          rows={3}
          required={decision === "changes_requested"}
          className="w-full border border-border rounded-md p-2 text-sm"
          placeholder={
            decision === "changes_requested"
              ? "e.g. Make the left-chest logo about 20% smaller"
              : ""
          }
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-error mb-sp-3">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "Sending…"
          : decision === "approved"
            ? "Approve proof"
            : "Request changes"}
      </Button>
    </form>
  );
}

/**
 * Renders each proof on a job from the customer's point of view.
 *
 * Only proofs the customer is actually being waited on get a form; the rest are
 * shown read-only so the history of the back-and-forth stays visible.
 */
export function ProofReview({
  jobId,
  proofs,
}: {
  jobId: string;
  proofs: ProofForReview[];
}) {
  if (proofs.length === 0) {
    return (
      <p className="text-sm text-text-secondary m-0">
        No proofs yet. Our art team will post one here for your approval.
      </p>
    );
  }

  return (
    <div className="space-y-sp-3">
      {[...proofs]
        .sort((a, b) => b.version - a.version)
        .map((proof) => {
          const undecided = !proof.decision || proof.decision === "pending";
          if (!undecided) return <DecidedProof key={proof.id} proof={proof} />;
          if (proof.awaitingDecisionFrom === "staff") {
            return <PendingWithStaff key={proof.id} proof={proof} />;
          }
          return (
            <ProofDecisionForm key={proof.id} jobId={jobId} proof={proof} />
          );
        })}
    </div>
  );
}
