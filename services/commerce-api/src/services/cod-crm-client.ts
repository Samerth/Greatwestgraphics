/**
 * COD CRM Client - HTTP wrapper with OAuth 2.0 Bearer token management
 *
 * Handles authentication with COD CRM using refresh tokens and automatic
 * access token refresh when expired.
 */

import { z } from "zod";

export class CodCRMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CodCRMError";
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  [key: string]: unknown;
}

interface ServiceJob {
  id: string;
  organizationId: string;
  contactId: string;
  title: string;
  description?: string;
  status: string; // "inquiry", "quoted", "scheduled", "in_progress", "completed", "invoiced", "paid"
  scheduledStart?: string;
  scheduledEnd?: string;
  assignedUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export class CodCRMClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAt: Date | null = null;
  private refreshToken: string;

  constructor(
    private baseUrl: string, // COD CRM API base URL
    private clientId: string,
    initialRefreshToken: string,
    private clientSecret: string,
  ) {
    this.refreshToken = initialRefreshToken;
  }

  /**
   * Ensure access token is valid, refresh if needed
   */
  private async ensureAccessToken(): Promise<string> {
    // Return current token if still valid (with 1 min buffer)
    if (
      this.accessToken &&
      this.accessTokenExpiresAt &&
      this.accessTokenExpiresAt > new Date(Date.now() + 60000)
    ) {
      return this.accessToken;
    }

    // Refresh token
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new CodCRMError(
        `Failed to refresh COD CRM access token: ${response.status}`,
        response.status,
        text,
      );
    }

    const data: TokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    this.refreshToken = data.refresh_token; // Refresh token rotates on use

    return this.accessToken;
  }

  /**
   * HTTP helper with automatic Bearer token injection
   */
  private async fetch(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = await this.ensureAccessToken();

    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get contact by email, or create if not found
   */
  async getOrCreateContact(
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<Contact> {
    // Try to find existing contact by email
    const listResponse = await this.fetch(`/api/contacts?email=${encodeURIComponent(email)}`);
    if (!listResponse.ok) {
      throw new CodCRMError(
        `Failed to search contacts: ${listResponse.statusText}`,
        listResponse.status,
      );
    }

    const listData = await listResponse.json();
    const contacts = Array.isArray(listData) ? listData : listData.data || [];

    if (contacts.length > 0) {
      return contacts[0] as Contact;
    }

    // Create new contact
    const createResponse = await this.fetch("/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        email,
        firstName,
        lastName,
      }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new CodCRMError(
        `Failed to create contact: ${createResponse.statusText}`,
        createResponse.status,
        text,
      );
    }

    return await createResponse.json() as Contact;
  }

  /**
   * Create a service job (order) in COD CRM
   */
  async createServiceJob(
    contactId: string,
    title: string,
    description?: string,
  ): Promise<ServiceJob> {
    const response = await this.fetch("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        contactId,
        title,
        description,
        status: "inquiry", // New jobs start as inquiry
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new CodCRMError(
        `Failed to create service job: ${response.statusText}`,
        response.status,
        text,
      );
    }

    return await response.json() as ServiceJob;
  }

  /**
   * Get service job status
   */
  async getServiceJob(jobId: string): Promise<ServiceJob> {
    const response = await this.fetch(`/api/jobs/${encodeURIComponent(jobId)}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new CodCRMError(
          `Service job not found: ${jobId}`,
          response.status,
        );
      }
      throw new CodCRMError(
        `Failed to fetch service job: ${response.statusText}`,
        response.status,
      );
    }

    return await response.json() as ServiceJob;
  }

  /**
   * Update service job status
   */
  async updateServiceJob(
    jobId: string,
    updates: Partial<ServiceJob>,
  ): Promise<ServiceJob> {
    const response = await this.fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new CodCRMError(
        `Failed to update service job: ${response.statusText}`,
        response.status,
      );
    }

    return await response.json() as ServiceJob;
  }

  /**
   * Get current refresh token (for storage)
   */
  getRefreshToken(): string {
    return this.refreshToken;
  }
}
