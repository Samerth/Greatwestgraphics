"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import type { PricingConfigV2 } from "@gwg/contracts";
import { adminToken, requireStaff } from "@/lib/admin/auth";
import { createCommerceClient } from "@/lib/commerce/client";

export async function savePricingV2DraftAction(config: PricingConfigV2) {
  await requireStaff();
  const client = await createCommerceClient();
  const saved = await client.savePricingV2Draft(config, adminToken());
  revalidatePath("/admin/pricing/v2");
  return { version: saved.version };
}

export async function publishPricingV2Action(notes: string) {
  await requireStaff();
  const client = await createCommerceClient();
  const published = await client.publishPricingV2Draft(
    adminToken(),
    randomUUID(),
    notes,
  );
  revalidatePath("/admin/pricing/v2");
  revalidatePath("/admin/pricing");
  return { version: published.version };
}

export async function restorePricingV2VersionAction(version: number) {
  await requireStaff();
  const client = await createCommerceClient();
  const draft = await client.restorePricingV2Version(version, adminToken());
  revalidatePath("/admin/pricing/v2");
  return { version: draft.version };
}
