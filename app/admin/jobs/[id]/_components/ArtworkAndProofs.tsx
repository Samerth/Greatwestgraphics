import type { JobRequestDetailResponse } from "@gwg/contracts";
import type { JobFile } from "@/lib/admin/job-view";
import { safeProofUrl } from "@/lib/admin/job-view";
import { proofStateFor } from "@/lib/admin/job-proof-status";
import { decideProofAction } from "@/app/admin/actions";
import { ProofUploadForm } from "@/components/admin/ProofUploadForm";
import { Badge } from "@/components/ui/Badge";

const PROOF_TONE = {
  not_uploaded: "neutral",
  sent: "info",
  needs_staff: "warning",
  approved: "success",
  revision: "warning",
} as const;

/** The client's points 6 and 10: a proof status that reads in one glance
 *  (Not Uploaded / Sent / Needs your review / ✓ Approved / Revision
 *  requested — see `proofStateFor`), and every file belonging to the order
 *  reachable from this one page rather than hunted down elsewhere. */
export function ArtworkAndProofs({
  jobId,
  customerPersonId,
  proofs,
  files,
}: {
  jobId: string;
  customerPersonId: string;
  proofs: JobRequestDetailResponse["proofs"];
  files: JobFile[];
}) {
  return (
    <div className="space-y-3">
      {proofs.length > 0 ? (
        <ul className="m-0 p-0 list-none space-y-3 text-sm">
          {proofs.map((proof) => {
            const state = proofStateFor(proof);
            const canDecide = state.state === "needs_staff";
            const proofUrl = safeProofUrl(proof.storageKey);
            const imageLike =
              Boolean(proofUrl) &&
              (/\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(proofUrl!) ||
                proofUrl!.includes("/api/uploads/"));
            return (
              <li key={proof.id} className="border border-border rounded-sm p-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <b>v{proof.version}</b>
                  <Badge size="sm" tone={PROOF_TONE[state.state]}>
                    {state.label}
                  </Badge>
                </div>
                {proofUrl ? (
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-xs font-bold text-accent"
                  >
                    {imageLike && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={proofUrl}
                        alt={`Proof version ${proof.version}`}
                        className="max-h-56 max-w-full object-contain border border-border rounded-sm bg-white mb-1"
                      />
                    )}
                    Open proof file ↗
                  </a>
                ) : (
                  <p role="alert" className="text-xs text-red-700 mt-1 mb-0">
                    Proof file is unavailable; upload a replacement.
                  </p>
                )}
                {proof.note && (
                  <p className="text-xs text-text-secondary mt-1 mb-0">Note: {proof.note}</p>
                )}
                {proof.decisionNote && (
                  <p className="text-xs text-text-secondary mt-1 mb-0">
                    Response: &ldquo;{proof.decisionNote}&rdquo;
                  </p>
                )}
                {proof.decision === "approved" && proof.decidedAt && (
                  <p className="text-xs font-bold text-green-800 mt-1 mb-0">
                    ✓ PROOF APPROVED — {new Date(proof.decidedAt).toLocaleDateString("en-CA")}
                  </p>
                )}
                {canDecide && (
                  <form action={decideProofAction} className="mt-2 space-y-2">
                    <input type="hidden" name="jobId" value={jobId} />
                    <input type="hidden" name="proofId" value={proof.id} />
                    <input
                      name="note"
                      placeholder="Note (required to request changes)"
                      className="block w-full border border-border rounded-sm px-2 py-1"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="approved"
                        className="bg-accent text-white font-bold px-3 py-1 rounded-sm"
                      >
                        Approve
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="changes_requested"
                        className="border border-border font-bold px-3 py-1 rounded-sm"
                      >
                        Request changes
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary m-0">No proofs yet.</p>
      )}
      <ProofUploadForm jobId={jobId} customerPersonId={customerPersonId} />

      {files.length > 0 && (
        <details className="border-t border-border pt-3">
          <summary className="text-sm font-semibold cursor-pointer">
            All files · {files.length}
          </summary>
          <ul className="m-0 mt-2 p-0 list-none space-y-1">
            {files.map((file, i) => (
              <li key={i} className="text-sm">
                <a
                  href={file.href}
                  target="_blank"
                  rel="noreferrer"
                  download={file.download}
                  className="text-accent underline"
                >
                  {file.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
