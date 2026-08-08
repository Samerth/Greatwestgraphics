"use server";

import { revalidatePath } from "next/cache";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export async function transitionJobAction(
  jobId: string,
  toStatus: string,
  reason?: string,
) {
  const client = await adminClient();
  await client.transitionJobRequest(
    jobId,
    toStatus,
    requireAdminToken(),
    reason,
  );
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function createFinalQuoteAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const dollars = Number(formData.get("amountDollars") || "0");
  const note = String(formData.get("note") || "") || undefined;
  const markAwaitingPayment = formData.has("markAwaitingPayment");
  if (!jobId || !Number.isFinite(dollars) || dollars <= 0) {
    throw new Error("Job and a positive quote amount are required");
  }
  const client = await adminClient();
  await client.createFinalQuote(
    jobId,
    {
      amountMinor: Math.round(dollars * 100),
      note,
      markAwaitingPayment,
    },
    requireAdminToken(),
  );
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/quotes");
}

export async function createProofAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const storageKey = String(formData.get("storageKey") || "").trim();
  const note = String(formData.get("note") || "") || undefined;
  if (!jobId || !storageKey) {
    throw new Error("Job and proof storage key/URL are required");
  }
  const client = await adminClient();
  await client.createProof(
    jobId,
    { storageKey, note },
    requireAdminToken(),
  );
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function runSyncAction(
  type: "full" | "inventory" | "csv_import",
  vendor = "ss_activewear",
) {
  const client = await adminClient();
  const result = await client.runCatalogSync(
    { type, vendor },
    requireAdminToken(),
  );
  revalidatePath("/admin/sync");
  revalidatePath("/admin");
  return result;
}

export async function runCsvImportAction(formData: FormData) {
  const vendor = String(formData.get("vendor") || "csv");
  const vendorKey = String(formData.get("vendorKey") || "").trim() || undefined;
  const csvContent = String(formData.get("csvContent") || "");
  const csvProducts = String(formData.get("csvProducts") || "") || undefined;
  const csvSkus = String(formData.get("csvSkus") || "") || undefined;
  const mode = String(formData.get("mode") || "full");
  if (!csvContent.trim() && !(csvProducts && csvSkus)) {
    throw new Error("Paste CSV content (or Sanmar products+skus pair)");
  }
  const client = await adminClient();
  const type =
    mode === "inventory"
      ? ("inventory" as const)
      : vendor === "csv" || csvContent
        ? ("csv_import" as const)
        : ("full" as const);
  await client.runCatalogSync(
    {
      type: vendor === "sanmar" && mode !== "inventory" ? "full" : type,
      vendor,
      vendorKey,
      csvContent: csvContent || undefined,
      csvProducts,
      csvSkus,
      csvInventory: mode === "inventory" ? csvContent : undefined,
    },
    requireAdminToken(),
  );
  revalidatePath("/admin/sync");
  revalidatePath("/admin");
}

export async function saveSettingsAction(formData: FormData) {
  const retailMarkup = String(formData.get("retailMarkup") || "2.0");
  const allowlistRaw = String(formData.get("brandAllowlist") || "");
  const brandAllowlist = allowlistRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const client = await adminClient();
  await client.updateCatalogSettings(
    { retailMarkup, brandAllowlist },
    requireAdminToken(),
  );
  revalidatePath("/admin/settings");
}

function categorySlugFrom(rawSlug: string, fallbackName = "") {
  const source = rawSlug.trim() || fallbackName.trim();
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createCategoryAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const slug = categorySlugFrom(String(formData.get("slug") || ""), name);
  if (!name) throw new Error("Category name is required");
  if (!slug) throw new Error("Could not create a URL name from that category name");
  const client = await adminClient();
  await client.createCategory({ name, slug }, requireAdminToken());
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(categoryId: string) {
  const client = await adminClient();
  await client.deleteCategory(categoryId, requireAdminToken());
  revalidatePath("/admin/categories");
}

export async function reorderCategoryAction(orderedIds: string[]) {
  const client = await adminClient();
  await client.reorderCategories(orderedIds, requireAdminToken());
  revalidatePath("/admin/categories");
}

export async function saveMappingAction(formData: FormData) {
  const ssCategoryKey = String(formData.get("ssCategoryKey") || "");
  const ssCategoryLabel = String(formData.get("ssCategoryLabel") || "");
  const categoryIds = formData.getAll("categoryIds").map(String);
  const client = await adminClient();
  await client.putCategoryMapping(
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
  const storefrontVisible = formData.has("storefrontVisible");
  const isDark = formData.has("isDark");
  // Optional vendor discontinued flag — only sent when the form includes it.
  const touchActive = formData.has("touchActive");
  const active = formData.has("active");
  const categoryIds = formData.getAll("categoryIds").map(String);
  const client = await adminClient();
  await client.patchCatalogProduct(
    productId,
    {
      storefrontVisible,
      isDark,
      ...(touchActive ? { active } : {}),
      categoryIds: categoryIds.length ? categoryIds : undefined,
    },
    requireAdminToken(),
  );
  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${productId}`);
}

export async function bulkCatalogVisibilityAction(formData: FormData) {
  const storefrontVisible = String(formData.get("storefrontVisible")) === "true";
  const productIds = formData
    .getAll("productIds")
    .map(String)
    .filter(Boolean);
  if (productIds.length === 0) {
    throw new Error("Select at least one product");
  }
  const client = await adminClient();
  await client.bulkSetCatalogVisibility(
    { productIds, storefrontVisible },
    requireAdminToken(),
  );
  revalidatePath("/admin/catalog");
}

export async function refreshCatalogProductAction(productId: string) {
  const client = await adminClient();
  await client.refreshCatalogProduct(productId, requireAdminToken());
  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath("/admin/sync");
}

export async function updateCategoryAction(
  categoryId: string,
  formData: FormData,
) {
  const name = String(formData.get("name") || "").trim();
  const slug = categorySlugFrom(String(formData.get("slug") || ""), name);
  if (!name) throw new Error("Category name is required");
  if (!slug) throw new Error("Could not create a URL name from that category name");
  const client = await adminClient();
  await client.updateCategory(
    categoryId,
    { name, slug },
    requireAdminToken(),
  );
  revalidatePath("/admin/categories");
}

export async function setStoreStatusAction(
  storeId: string,
  status: "active" | "suspended",
) {
  const client = await adminClient();
  await client.setStoreStatus(storeId, status, requireAdminToken());
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/${storeId}`);
}

export async function setStoreCategoryVisibilityAction(
  storeId: string,
  formData: FormData,
) {
  const categoryIds = formData.getAll("categoryIds").map(String);
  const client = await adminClient();
  await client.setStoreCategoryVisibility(
    storeId,
    categoryIds,
    requireAdminToken(),
  );
  revalidatePath(`/admin/accounts/${storeId}`);
}

export async function setStorePricingAdjustmentAction(
  storeId: string,
  formData: FormData,
) {
  const raw = String(formData.get("percent") ?? "").trim();
  const percent = raw === "" ? null : Number(raw);
  if (percent != null && !Number.isFinite(percent)) {
    throw new Error("Pricing adjustment must be a number");
  }
  const client = await adminClient();
  await client.setStorePricingAdjustment(
    storeId,
    percent,
    requireAdminToken(),
  );
  revalidatePath(`/admin/accounts/${storeId}`);
}
