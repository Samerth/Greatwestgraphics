/**
 * COD CRM Service - Order handoff and status synchronization
 *
 * Handles pushing orders to COD CRM after payment and syncing status updates
 * back to customers via polling.
 */

import { eq, isNotNull } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client.js";
import {
  crmOrderSyncs,
  crmStatusUpdates,
  jobRequests,
  people,
} from "../db/schema.js";
import { CodCRMClient, CodCRMError } from "./cod-crm-client.js";

export interface CRMSyncResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof CodCRMError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export class CodCRMService {
  private client: CodCRMClient;

  constructor(
    private readonly db: CommerceDatabase,
    baseUrl: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ) {
    this.client = new CodCRMClient(
      baseUrl,
      clientId,
      refreshToken,
      clientSecret,
    );
  }

  /**
   * Push order to COD CRM after payment received
   */
  async pushOrderToCRM(jobRequestId: string): Promise<CRMSyncResult> {
    try {
      const [jobRequest] = await this.db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, jobRequestId))
        .limit(1);

      if (!jobRequest) {
        return { success: false, error: "Job request not found" };
      }

      if (jobRequest.paymentStatus !== "succeeded") {
        return {
          success: false,
          error: `Cannot sync to CRM: payment status is ${jobRequest.paymentStatus}`,
        };
      }

      const [customer] = await this.db
        .select()
        .from(people)
        .where(eq(people.id, jobRequest.customerPersonId))
        .limit(1);

      if (!customer) {
        return { success: false, error: "Customer not found" };
      }

      const nameParts = (customer.displayName || "Unknown Customer")
        .trim()
        .split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "Customer";

      const contact = await this.client.getOrCreateContact(
        customer.email ?? "",
        firstName,
        lastName,
      );

      const serviceJob = await this.client.createServiceJob(
        contact.id,
        `${jobRequest.displayId} — Custom products`,
        this.buildJobDescription(jobRequest, customer),
      );

      await this.db.insert(crmOrderSyncs).values({
        tenantId: jobRequest.tenantId,
        jobRequestId: jobRequest.id,
        codCrmJobId: serviceJob.id,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      });

      await this.db
        .update(jobRequests)
        .set({
          codCrmJobId: serviceJob.id,
        })
        .where(eq(jobRequests.id, jobRequestId));

      return { success: true, jobId: serviceJob.id };
    } catch (error: unknown) {
      const message = errorMessage(error);

      const [existing] = await this.db
        .select()
        .from(crmOrderSyncs)
        .where(eq(crmOrderSyncs.jobRequestId, jobRequestId))
        .limit(1);

      if (existing) {
        await this.db
          .update(crmOrderSyncs)
          .set({
            syncStatus: "failed",
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(crmOrderSyncs.jobRequestId, jobRequestId));
      } else {
        const [job] = await this.db
          .select()
          .from(jobRequests)
          .where(eq(jobRequests.id, jobRequestId))
          .limit(1);
        if (job) {
          await this.db.insert(crmOrderSyncs).values({
            tenantId: job.tenantId,
            jobRequestId,
            syncStatus: "failed",
            errorMessage: message,
          });
        }
      }

      return { success: false, error: message };
    }
  }

  /**
   * Sync job status from COD CRM (polling)
   */
  async syncJobStatusFromCRM(jobRequestId: string): Promise<boolean> {
    try {
      const [jobRequest] = await this.db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, jobRequestId))
        .limit(1);

      if (!jobRequest || !jobRequest.codCrmJobId) {
        return false;
      }

      const codJob = await this.client.getServiceJob(jobRequest.codCrmJobId);
      const internalStatus = this.mapCodCRMStatus(codJob.status);

      const [lastUpdate] = await this.db
        .select()
        .from(crmStatusUpdates)
        .where(eq(crmStatusUpdates.jobRequestId, jobRequestId))
        .limit(1);

      const statusChanged =
        !lastUpdate || lastUpdate.codCrmStatus !== codJob.status;

      if (statusChanged) {
        await this.db.insert(crmStatusUpdates).values({
          tenantId: jobRequest.tenantId,
          jobRequestId: jobRequest.id,
          codCrmStatus: codJob.status,
          mappedInternalStatus: internalStatus,
          isProcessed: true,
          processedAt: new Date(),
        });

        await this.db
          .update(crmOrderSyncs)
          .set({
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(crmOrderSyncs.jobRequestId, jobRequestId));
      }

      return statusChanged;
    } catch (error: unknown) {
      console.error(
        `Failed to sync CRM status for job ${jobRequestId}:`,
        errorMessage(error),
      );
      return false;
    }
  }

  /**
   * Sync all pending jobs (called by polling worker)
   */
  async syncAllPendingJobs(): Promise<{ changed: number; unchanged: number }> {
    try {
      const jobsWithCRM = await this.db
        .select()
        .from(jobRequests)
        .where(isNotNull(jobRequests.codCrmJobId))
        .limit(100);

      let changed = 0;
      let unchanged = 0;

      for (const job of jobsWithCRM) {
        const statusChanged = await this.syncJobStatusFromCRM(job.id);
        if (statusChanged) {
          changed++;
        } else {
          unchanged++;
        }
      }

      return { changed, unchanged };
    } catch (error: unknown) {
      console.error("Failed to sync pending CRM jobs:", errorMessage(error));
      return { changed: 0, unchanged: 0 };
    }
  }

  private buildJobDescription(
    jobRequest: typeof jobRequests.$inferSelect,
    customer: typeof people.$inferSelect,
  ): string {
    const lines = [
      `Job: ${jobRequest.displayId}`,
      `Customer: ${customer.displayName || "Unknown"}`,
      `Email: ${customer.email || "N/A"}`,
      `Amount: $${
        jobRequest.finalQuoteAmountMinor
          ? (jobRequest.finalQuoteAmountMinor / 100).toFixed(2)
          : "TBD"
      }`,
      `Order Date: ${
        jobRequest.submittedAt
          ? new Date(jobRequest.submittedAt).toLocaleDateString()
          : "N/A"
      }`,
    ];

    if (jobRequest.customerNote) {
      lines.push(`Notes: ${jobRequest.customerNote}`);
    }

    return lines.join("\n");
  }

  private mapCodCRMStatus(codStatus: string): string {
    const statusMap: Record<string, string> = {
      inquiry: "Received",
      quoted: "Quoted",
      scheduled: "Scheduled",
      in_progress: "In Production",
      completed: "Quality Check",
      invoiced: "Ready to Ship",
      paid: "Completed",
    };

    return statusMap[codStatus] || codStatus;
  }
}
