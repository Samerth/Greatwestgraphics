import { and, eq } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client.js";
import { jobRequests, people } from "../db/schema.js";

export type CodChatOrderStatus = {
  orderRef: string;
  status: string;
  updatedAt: string;
};

/**
 * Customer-facing labels for every job_request_status value. Deliberately a
 * local copy of the labels in lib/commerce/status.ts (the Next.js app),
 * rather than a shared import — that file lives in a different deployable
 * package and pulls in app-only concerns (next-action copy, payment-ready
 * flags) this endpoint has no use for. Keep the wording in sync by hand if
 * either changes: a customer should never see two different words for the
 * same status depending on whether they asked the portal page or the chat.
 */
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  rejected: "Unable to proceed",
  approved: "Design approved",
  awaiting_payment: "Payment ready",
  payment_pending: "Payment processing",
  payment_failed: "Payment needs attention",
  paid: "Paid",
  ready_for_production: "Ready for production",
  in_production: "In production",
  ready_for_pickup: "Ready for pickup",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

export class CodChatOrderLookupService {
  constructor(private readonly db: CommerceDatabase) {}

  /**
   * Looks up one job by its customer-facing display id (e.g. "GWG-1001"),
   * but only returns it when `verifiedEmail` matches the job's actual owner.
   *
   * CodChat has already proven the visitor controls that email address via a
   * one-time code before this is ever called — the connector framework
   * injects it server-side as `verified_email` and a model or visitor
   * argument can never override it (see the CodChat live-data-tools memory
   * note). This check is what turns that proof into "you may see this one
   * record": without it, knowing any real order reference would return
   * someone else's status.
   *
   * Returns null for both "no such order" and "wrong email for a real
   * order," on purpose — the caller must not be able to tell those apart. A
   * distinguishable response would let a caller holding the connector's API
   * key (or someone who obtained it) confirm which order references exist
   * simply by trying emails against them.
   */
  async lookup(
    tenantId: string,
    orderRef: string,
    verifiedEmail: string,
  ): Promise<CodChatOrderStatus | null> {
    const normalizedEmail = verifiedEmail.trim().toLowerCase();

    const [row] = await this.db
      .select({
        status: jobRequests.status,
        updatedAt: jobRequests.updatedAt,
        ownerEmail: people.email,
      })
      .from(jobRequests)
      .innerJoin(people, eq(people.id, jobRequests.customerPersonId))
      .where(
        and(
          eq(jobRequests.tenantId, tenantId),
          eq(jobRequests.displayId, orderRef),
        ),
      )
      .limit(1);

    // people.email is nullable (phone-only contacts exist) — treat a missing
    // owner email the same as a mismatch, never as a free pass.
    if (!row || !row.ownerEmail || row.ownerEmail.trim().toLowerCase() !== normalizedEmail) {
      return null;
    }

    return {
      orderRef,
      status: STATUS_LABELS[row.status] ?? row.status,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
