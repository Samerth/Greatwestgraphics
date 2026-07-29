"use server";

import { revalidatePath } from "next/cache";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export async function transitionJobAction(
  jobId: string,
  toStatus: string,
  reason?: string,
) {
  await adminClient().transitionJobRequest(
    jobId,
    toStatus,
    requireAdminToken(),
    reason,
  );
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function runSyncAction(type: "full" | "inventory") {
  const result = await adminClient().runCatalogSync(
    type,
    requireAdminToken(),
  );
  revalidatePath("/admin/sync");
  revalidatePath("/admin");
  return result;
}

export async function saveSettingsAction(formData: FormData) {
  const retailMarkup = String(formData.get("retailMarkup") || "2.0");
  const allowlistRaw = String(formData.get("brandAllowlist") || "");
  const brandAllowlist = allowlistRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await adminClient().updateCatalogSettings(
    { retailMarkup, brandAllowlist },
    requireAdminToken(),
  );
  revalidatePath("/admin/settings");
}

export async function createCategoryAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!name || !slug) throw new Error("Name and slug are required");
  await adminClient().createCategory({ name, slug }, requireAdminToken());
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(categoryId: string) {
  await adminClient().deleteCategory(categoryId, requireAdminToken());
  revalidatePath("/admin/categories");
}

export async function reorderCategoryAction(
  orderedIds: string[],
) {
  await adminClient().reorderCategories(orderedIds, requireAdminToken());
  revalidatePath("/admin/categories");
}

export async function saveMappingAction(formData: FormData) {
  const ssCategoryKey = String(formData.get("ssCategoryKey") || "");
  const ssCategoryLabel = String(formData.get("ssCategoryLabel") || "");
  const categoryIds = formData.getAll("categoryIds").map(String);
  await adminClient().putCategoryMapping(
    {
      ssCategoryKey,
      ssCategoryLabel: ssCategoryLabel || undefined,
      categoryIds,
    },
    requireAdminToken(),
  );
  revalidatePath("/admin/categories/mappings");
  revalidatePath("/admin/catalog");
}

export async function patchProductAction(
  productId: string,
  formData: FormData,
) {
  const active = formData.has("active");
  const isDark = formData.has("isDark");
  const categoryIds = formData.getAll("categoryIds").map(String);
  await adminClient().patchCatalogProduct(
    productId,
    {
      active,
      isDark,
      categoryIds: categoryIds.length ? categoryIds : undefined,
    },
    requireAdminToken(),
  );
  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${productId}`);
}
