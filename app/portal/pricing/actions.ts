"use server";

import { revalidatePath } from "next/cache";
import type { PricingConfig } from "@gwg/contracts";
import { createCommerceClient } from "@/lib/commerce/client";

function adminToken(): string {
  const token = process.env.DEV_ADMIN_TOKEN;
  if (!token) {
    throw new Error("DEV_ADMIN_TOKEN is not configured");
  }
  return token;
}

export async function savePricingDraftAction(config: PricingConfig) {
  await createCommerceClient().savePricingDraft(config, adminToken());
  revalidatePath("/admin/pricing");
  revalidatePath("/portal/pricing");
}

export async function publishPricingDraftAction() {
  const key = `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await createCommerceClient().publishPricingDraft(adminToken(), key);
  revalidatePath("/admin/pricing");
  revalidatePath("/portal/pricing");
}

export async function restorePricingVersionAction(version: number) {
  const client = createCommerceClient();
  const token = adminToken();
  // Restore via admin restore endpoint through a temporary draft upsert from version list view.
  const env = process.env;
  const response = await fetch(
    `${env.COMMERCE_API_BASE_URL}/admin/pricing-config/restore`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": env.COMMERCE_DEV_TENANT_ID ?? "",
        "x-account-id": env.COMMERCE_DEV_ACCOUNT_ID ?? "",
        "x-store-id": env.COMMERCE_DEV_STORE_ID ?? "",
        "x-actor-id": env.COMMERCE_DEV_CUSTOMER_PERSON_ID ?? "",
        "x-dev-admin-token": token,
      },
      body: JSON.stringify({
        context: {
          tenantId: env.COMMERCE_DEV_TENANT_ID,
          accountId: env.COMMERCE_DEV_ACCOUNT_ID,
          storeId: env.COMMERCE_DEV_STORE_ID,
        },
        version,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Restore failed");
  }
  revalidatePath("/admin/pricing");
  revalidatePath("/portal/pricing");
}
