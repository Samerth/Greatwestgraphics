"use server";

import { revalidatePath } from "next/cache";
import type { PricingConfig } from "@gwg/contracts";
import { adminToken, requireStaff } from "@/lib/admin/auth";
import { createCommerceClient } from "@/lib/commerce/client";

/**
 * Staff-only pricing mutations, left behind in the portal tree when the admin
 * pricing UI moved to `/admin/pricing`. There is no page in this directory, so
 * it serves no route — `requireStaff()` on each action is what protects them,
 * not their URL. See the note on `requireStaff` in `lib/admin/auth.ts`.
 */
export async function savePricingDraftAction(config: PricingConfig) {
  await requireStaff();
  await (await createCommerceClient()).savePricingDraft(config, adminToken());
  revalidatePath("/admin/pricing");
}

export async function publishPricingDraftAction() {
  await requireStaff();
  const key = `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await (await createCommerceClient()).publishPricingDraft(adminToken(), key);
  revalidatePath("/admin/pricing");
}

export async function restorePricingVersionAction(version: number) {
  await requireStaff();
  const client = await createCommerceClient();
  await client.restorePricingVersion(version, adminToken());
  revalidatePath("/admin/pricing");
}
