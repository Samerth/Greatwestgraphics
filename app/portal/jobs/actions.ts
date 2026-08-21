"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CommerceApiError } from "@/lib/commerce/client";
import { createPortalClientForJob } from "@/lib/commerce/portal-client";
import { getCustomerSession } from "@/lib/auth/session";
import { getImageStore } from "@/lib/storage";

const ARTWORK_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;

export interface ProofDecisionState {
  error?: string;
  ok?: boolean;
}

export interface QuoteAcceptanceState {
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
    await (await createPortalClientForJob(jobId)).decideProof(jobId, proofId, {
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

export async function acceptFinalQuoteAction(
  jobId: string,
  finalQuoteId: string,
  _previous: QuoteAcceptanceState,
  _formData: FormData,
): Promise<QuoteAcceptanceState> {
  const session = await getCustomerSession();
  if (!session) {
    return { error: "Your session expired. Sign in again to accept the quote." };
  }

  try {
    await (await createPortalClientForJob(jobId)).acceptFinalQuote(jobId, finalQuoteId);
  } catch (caught) {
    return {
      error:
        caught instanceof CommerceApiError
          ? caught.message
          : "We could not record your acceptance. Please try again.",
    };
  }

  revalidatePath(`/portal/jobs/${jobId}`);
  revalidatePath("/portal/jobs");
  return { ok: true };
}

export interface ChangeReplyState {
  error?: string;
  ok?: boolean;
}

export interface InvoiceRequestState {
  error?: string;
  ok?: boolean;
}

export async function respondToChangesAction(
  jobId: string,
  _previous: ChangeReplyState,
  formData: FormData,
): Promise<ChangeReplyState> {
  const session = await getCustomerSession();
  if (!session) {
    return { error: "Your session expired. Sign in again to reply." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) {
    return { error: "Tell us what you changed so we can continue the review." };
  }

  const file = formData.get("file");
  let storageKey: string | undefined;
  if (file instanceof File && file.size > 0) {
    const extension = ARTWORK_TYPES[file.type];
    if (!extension) {
      return { error: "Replacement artwork must be a PNG, JPG, or SVG." };
    }
    if (file.size > MAX_ARTWORK_BYTES) {
      return { error: "Replacement artwork is too large — max 10MB." };
    }
    storageKey = await getImageStore().put(
      `designs/${session.personId}/revision-${randomUUID()}.${extension}`,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
  }

  try {
    await (await createPortalClientForJob(jobId)).respondToChanges(jobId, {
      note,
      storageKey,
    });
  } catch (caught) {
    return {
      error:
        caught instanceof CommerceApiError
          ? caught.message
          : "We could not send your revision. Please try again.",
    };
  }

  revalidatePath(`/portal/jobs/${jobId}`);
  revalidatePath("/portal/jobs");
  return { ok: true };
}


export interface CardPaymentState {
  error?: string;
}

/**
 * Sends the customer to Stripe Checkout for an accepted quote.
 *
 * The redirect is thrown outside the try block on purpose: Next implements
 * `redirect()` by throwing, so catching it here would turn a successful
 * checkout into "we could not start the payment".
 */
export async function startCardPaymentAction(
  jobId: string,
  _previous: CardPaymentState,
  _formData: FormData,
): Promise<CardPaymentState> {
  const session = await getCustomerSession();
  if (!session) {
    return { error: "Your session expired. Sign in again to pay." };
  }

  let checkoutUrl: string;
  try {
    const created = await (
      await createPortalClientForJob(jobId)
    ).createCheckoutSession(jobId);
    checkoutUrl = created.checkoutUrl;
  } catch (caught) {
    return {
      error:
        caught instanceof CommerceApiError
          ? caught.message
          : "We could not start the card payment. Please try again, or request an invoice instead.",
    };
  }

  revalidatePath(`/portal/jobs/${jobId}`);
  redirect(checkoutUrl);
}
export async function requestInvoiceAction(
  jobId: string,
  _previous: InvoiceRequestState,
  _formData: FormData,
): Promise<InvoiceRequestState> {
  const session = await getCustomerSession();
  if (!session) {
    return { error: "Your session expired. Sign in again to request the invoice." };
  }

  try {
    await (await createPortalClientForJob(jobId)).requestInvoice(jobId);
  } catch (caught) {
    return {
      error:
        caught instanceof CommerceApiError
          ? caught.message
          : "We could not record the invoice request. Please try again.",
    };
  }

  revalidatePath(`/portal/jobs/${jobId}`);
  revalidatePath("/portal/jobs");
  return { ok: true };
}
