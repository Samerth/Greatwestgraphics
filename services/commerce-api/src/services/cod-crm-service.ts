/**
 * COD CRM Service - Order handoff and status synchronization
 *
 * Handles pushing orders to COD CRM after payment and syncing status updates
 * back to customers via polling.
 */

import { db } from "../db";
import {
  jobRequests,
  crmOrderSyncs,
  crmStatusUpdates,
  people,
} from "../db/schema";
import { eq, sql, isNotNull } from "drizzle-orm";
import { CodCRMClient, CodCRMError } from "./cod-crm-client";

export interface CRMSyncResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export class CodCRMService {
  private client: CodCRMClient;

  constructor(
    private baseUrl: string,
    private clientId: string,
    private clientSecret: string,
    private refreshToken: string,
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
      // Fetch job request with customer details
      const [jobRequest] = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, jobRequestId))
        .limit(1);

      if (!jobRequest) {
        return { success: false, error: "Job request not found" };
      }

      // Verify payment succeeded
      if (jobRequest.paymentStatus !== "succeeded") {
        return {
          success: false,
          error: `Cannot sync to CRM: payment status is ${jobRequest.paymentStatus}`,
        };
      }

      // Fetch customer info
      const [customer] = await db
        .select()
        .from(people)
        .where(eq(people.id, jobRequest.customerPersonId))
        .limit(1);

      if (!customer) {
        return { success: false, error: "Customer not found" };
      }

      // Get or create contact in COD CRM
      const contact = await this.client.getOrCreateContact(
        customer.email,
        customer.firstName || "Unknown",
        customer.lastName || "Customer",
      );

      // Create service job in COD CRM using the human job reference
      const serviceJob = await this.client.createServiceJob(
        contact.id,
        `${jobRequest.displayId} — Custom products`,
        this.buildJobDescription(jobRequest, customer),
      );

      // Store mapping in database
      await db.insert(crmOrderSyncs).values({
        tenantId: jobRequest.tenantId,
        jobRequestId: jobRequest.id,
        codCrmJobId: serviceJob.id,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      });

      // Update job request with CRM job ID
      await db
        .update(jobRequests)
        .set({
          codCrmJobId: serviceJob.id,
          lastCrmSyncAt: new Date(),
        })
        .where(eq(jobRequests.id, jobRequestId));

      return { success: true, jobId: serviceJob.id };
    } catch (error) {
      const errorMessage =
        error instanceof CodCRMError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error";

      // Store error for retry
      const [existing] = await db
        .select()
        .from(crmOrderSyncs)
        .where(eq(crmOrderSyncs.jobRequestId, jobRequestId))
        .limit(1);

      if (existing) {
        await db
          .update(crmOrderSyncs)
          .set({
            syncStatus: "failed",
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(crmOrderSyncs.jobRequestId, jobRequestId));
      } else {
        await db.insert(crmOrderSyncs).values({
          tenantId: (await db.select().from(jobRequests).where(eq(jobRequests.id, jobRequestId)).limit(1))[0]?.tenantId,
          jobRequestId,
          syncStatus: "failed",
          errorMessage,
        });
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync job status from COD CRM (polling)
   */
  async syncJobStatusFromCRM(jobRequestId: string): Promise<boolean> {
    try {
      // Fetch job request
      const [jobRequest] = await db
        .select()
        .from(jobRequests)
        .where(eq(jobRequests.id, jobRequestId))
        .limit(1);

      if (!jobRequest || !jobRequest.codCrmJobId) {
        return false; // No CRM job to sync
      }

      // Get current job status from COD CRM
      const codJob = await this.client.getServiceJob(jobRequest.codCrmJobId);

      // Map COD CRM status to internal status
      const internalStatus = this.mapCodCRMStatus(codJob.status);

      // Check if status changed
      const [lastUpdate] = await db
        .select()
        .from(crmStatusUpdates)
        .where(eq(crmStatusUpdates.jobRequestId, jobRequestId))
        .limit(1);

      const statusChanged = !lastUpdate || lastUpdate.codCrmStatus !== codJob.status;

      if (statusChanged) {
        // Store status update
        await db.insert(crmStatusUpdates).values({
          tenantId: jobRequest.tenantId,
          jobRequestId: jobRequest.id,
          codCrmStatus: codJob.status,
          mappedInternalStatus: internalStatus,
          isProcessed: true,
          processedAt: new Date(),
        });

        // Update job request status
        if (internalStatus) {
          // Could update jobRequest.status if needed
          // For now, just track in CRM status table
        }

        // Update last sync time
        await db
          .update(jobRequests)
          .set({
            lastCrmSyncAt: new Date(),
          })
          .where(eq(jobRequests.id, jobRequestId));
      }

      return statusChanged;
    } catch (error) {
      console.error(`Failed to sync CRM status for job ${jobRequestId}:`, error);
      return false;
    }
  }

  /**
   * Sync all pending jobs (called by polling worker)
   * Returns count of syncs that detected status changes
   */
  async syncAllPendingJobs(): Promise<{ changed: number; unchanged: number }> {
    try {
      // Get all jobs with CRM job ID
      const jobsWithCRM = await db
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
    } catch (error) {
      console.error("Failed to sync pending CRM jobs:", error);
      return { changed: 0, unchanged: 0 };
    }
  }

  /**
   * Build human-readable job description for COD CRM
   */
  private buildJobDescription(
    jobRequest: typeof jobRequests.$inferSelect,
    customer: typeof people.$inferSelect,
  ): string {
    const lines = [
      `Job: ${jobRequest.displayId}`,
      `Customer: ${customer.firstName} ${customer.lastName}`,
      `Email: ${customer.email}`,
      `Amount: $${jobRequest.finalQuoteAmountMinor ? (jobRequest.finalQuoteAmountMinor / 100).toFixed(2) : "TBD"}`,
      `Order Date: ${jobRequest.submittedAt ? new Date(jobRequest.submittedAt).toLocaleDateString() : "N/A"}`,
    ];

    if (jobRequest.customerNote) {
      lines.push(`Notes: ${jobRequest.customerNote}`);
    }

    return lines.join("\n");
  }

  /**
   * Map COD CRM status to internal/display status
   */
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
