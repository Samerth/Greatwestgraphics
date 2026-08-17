"use server";

import { revalidatePath } from "next/cache";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";
import { getCustomerSession } from "@/lib/auth/session";

export interface ProofDecisionState {
  error?: string;
  ok?: boolean;
}

/**
 * The customer's half of the proof round trip.
 *
 * The API is the thing that decides whether this is allowed — it refuses a
 * verdict from the side that raised the proof, and refuses a second verdict on
 * a proof already decided. This action only carries the customer's session
 * through and turns a refusal into something the page can display.
 */
export async function decideProofAction(
  jobId: string,
  proofId: string,
  _previous: ProofDecisionState,
  formData: FormData,
): Promise<ProofDecisionState> {
  const session = await getCustomerSession();
  if (!session) {
    return { error: "Your session expired. Sign in again to respond." };
  }

  const decision = formData.get("decision");
  if (decision !== "approved" && decision !== "changes_requested") {
    return { error: "Choose whether to approve or request changes." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (decision === "changes_requested" && !note) {
    return { error: "Tell us what to change so we can turn the revision around." };
  }

  try {
    await (await createCommerceClient()).decideProof(jobId, proofId, {
      decision,
      note: note || undefined,
    });
  } catch (caught) {
    return {
      error:
        caught instanceof CommerceApiError
          ? caught.message
          : "We could not record your response. Please try again.",
    };
  }

  revalidatePath(`/portal/jobs/${jobId}`);
  revalidatePath("/portal/jobs");
  return { ok: true };
}
