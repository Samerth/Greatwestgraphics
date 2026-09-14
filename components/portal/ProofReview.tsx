"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/shared/Button";
import {
  PROOF_APPROVAL_WARNING,
  formatPortalDate,
  formatPortalDateTime,
} from "@/lib/commerce/portal-progress";
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
  createdAt?: string | null;
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

/**
 * The proof itself, given the room the client asked for: "The current proof
 * area is too small. The proof should have a large preview, ideally using
 * most of the available content width." (UAT V2 row 55, point 4.)
 */
function ProofAsset({ proof }: { proof: ProofForReview }) {
  const url = safeProofUrl(proof.storageKey);
  const [fileMissing, setFileMissing] = useState(false);
  if (!url || fileMissing) {
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
    <figure data-portal="proof-asset" className="m-0 my-sp-3">
      {imageLike ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Proof version ${proof.version}`}
            className="w-full max-h-[32rem] object-contain border border-border rounded-md bg-white"
            // Same message as a malformed URL — a 404'd file reads no
            // differently to the person reviewing it, and a broken-image
            // icon on a customer-facing proof review page is exactly the
            // kind of thing worth never showing (found during a live audit).
            onError={() => setFileMissing(true)}
          />
        </a>
      ) : null}
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">
          <b className="text-text-primary">Proof V{proof.version}</b>
          {proof.createdAt
            ? ` · Uploaded ${formatPortalDate(proof.createdAt)}`
            : ""}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-bold text-accent hover:underline"
        >
          View Full Proof ↗
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * Point 5: "Once approved, don't continue showing it as an open action."
 * The proof stays viewable; every control that implies a pending decision is
 * gone.
 */
function ApprovedProof({ proof }: { proof: ProofForReview }) {
  return (
    <div
      data-portal="proof-approved"
      className="border-2 border-accent rounded-md p-sp-4 bg-accent-tint"
    >
      <p className="m-0 font-display font-bold text-lg text-accent">
        ✓ PROOF APPROVED
      </p>
      {proof.decidedAt ? (
        <p className="m-0 mt-1 text-sm text-text-secondary">
          Approved {formatPortalDateTime(proof.decidedAt)}
        </p>
      ) : null}
      <p className="m-0 mt-1 text-sm text-text-secondary">
        This order has been released for production.
      </p>
      <ProofAsset proof={proof} />
      {proof.decisionNote && (
        <p className="text-sm text-text-secondary mt-sp-2 mb-0">
          Your note: “{proof.decisionNote}”
        </p>
      )}
    </div>
  );
}

function ChangesRequestedProof({ proof }: { proof: ProofForReview }) {
  return (
    <div className="border border-border rounded-md p-sp-4">
      <div className="flex flex-wrap items-center justify-between gap-sp-2">
        <b>Proof V{proof.version}</b>
        <span className="bg-fill-subtle-15 text-text-secondary px-3 py-1 rounded-full text-sm font-bold">
          Changes requested
        </span>
      </div>
      <ProofAsset proof={proof} />
      {proof.decisionNote && (
        <p className="text-sm text-text-secondary mt-sp-2 mb-0">
          You asked for: “{proof.decisionNote}”
        </p>
      )}
      {proof.decidedAt && (
        <p className="text-xs text-text-tertiary mt-1 mb-0">
          {formatPortalDateTime(proof.decidedAt)}
        </p>
      )}
    </div>
  );
}

function PendingWithStaff({ proof }: { proof: ProofForReview }) {
  return (
    <div className="border border-border rounded-md p-sp-4">
      <div className="flex flex-wrap items-center justify-between gap-sp-2">
        <b>Proof V{proof.version}</b>
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
    <form
      action={formAction}
      data-portal="proof-decision"
      className="border-2 border-accent rounded-md p-sp-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-sp-2">
        <b className="font-display text-lg">Proof V{proof.version}</b>
        <span className="bg-accent text-white px-3 py-1 rounded-full text-sm font-bold">
          Awaiting your approval
        </span>
      </div>

      {proof.note && (
        <p className="text-sm text-text-secondary mt-sp-2 mb-0">
          Note from our team: {proof.note}
        </p>
      )}
      <ProofAsset proof={proof} />

      <fieldset className="border-0 p-0 m-0 mb-sp-3">
        <legend className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
          Your response
        </legend>
        <label className="flex items-start gap-2 text-sm mb-2 cursor-pointer">
          <input
            type="radio"
            name="decision"
            value="approved"
            checked={decision === "approved"}
            onChange={() => setDecision("approved")}
            className="mt-1"
          />
          <span>
            <span className="font-semibold">
              Approve this proof for production
            </span>
            {/* Sits with the control it qualifies, not in the small print at
                the bottom — this is the sentence that makes an approval
                mean something. */}
            <span
              data-portal="approval-warning"
              className="block text-[12.5px] leading-snug text-text-tertiary mt-1"
            >
              {PROOF_APPROVAL_WARNING}
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="decision"
            value="changes_requested"
            checked={decision === "changes_requested"}
            onChange={() => setDecision("changes_requested")}
          />
          <span className="font-semibold">Request changes</span>
        </label>
      </fieldset>

      {/* Only asked for when it is actually needed (point 4). An optional box
          under an approval invites people to type instead of approving. */}
      {decision === "changes_requested" && (
        <label className="block text-sm mb-sp-3">
          <span className="text-xs font-bold uppercase tracking-wide text-text-tertiary block mb-1.5">
            What should we change?
          </span>
          <textarea
            name="note"
            rows={3}
            required
            className="w-full border border-border rounded-md p-2 text-sm"
            placeholder="e.g. Make the left-chest logo about 20% smaller"
          />
        </label>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-error mb-sp-3">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "Sending…"
          : decision === "approved"
            ? "APPROVE PROOF"
            : "SUBMIT REVISION REQUEST"}
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
          if (!undecided) {
            return proof.decision === "approved" ? (
              <ApprovedProof key={proof.id} proof={proof} />
            ) : (
              <ChangesRequestedProof key={proof.id} proof={proof} />
            );
          }
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
