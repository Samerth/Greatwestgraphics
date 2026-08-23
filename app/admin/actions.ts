"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { requireStaff } from "@/lib/admin/auth";
import { mappingListHref, parseMappingTab } from "@/lib/admin/mapping-list";
import { parsePage } from "@/lib/admin/paged-list";
import {
  buildStoreApprovedEmail,
  publicSiteOrigin,
} from "@/lib/commerce/store-approved-email";
import { sendEmail } from "@/lib/email/send";
import { getImageStore } from "@/lib/storage";

const PROOF_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const PERSON_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function issueInvoiceAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const note = String(formData.get("note") || "") || undefined;
  if (!jobId) throw new Error("Job is required");
  const client = await adminClient();
  await client.issueInvoice(jobId, note, requireAdminToken());
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}

export async function recordPaymentAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const note = String(formData.get("note") || "").trim();
  if (!jobId) throw new Error("Job is required");
  if (!note) throw new Error("Say how the payment was received");
  const client = await adminClient();
  await client.recordPayment(jobId, note, requireAdminToken());
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
}

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
  await requireStaff();
  const jobId = String(formData.get("jobId") || "");
  const note = String(formData.get("note") || "") || undefined;
  const personId = String(formData.get("customerPersonId") || "");
  const file = formData.get("file");
  let storageKey = String(formData.get("storageKey") || "").trim();

  if (file instanceof File && file.size > 0) {
    const extension = PROOF_TYPES[file.type];
    if (!extension) {
      throw new Error("Proof must be a PNG, JPG, or SVG");
    }
    if (file.size > MAX_PROOF_BYTES) {
      throw new Error("Proof file is too large — max 10MB");
    }
    const owner = PERSON_ID_PATTERN.test(personId) ? personId : "staff";
    const key = `designs/${owner}/staff-${randomUUID()}.${extension}`;
    storageKey = await getImageStore().put(
      key,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
  }

  if (!jobId || !storageKey) {
    throw new Error("Job and a proof file are required");
  }
  const client = await adminClient();
  await client.createProof(
    jobId,
    // A staff proof is always the customer's turn next. Naming it here rather
    // than letting the API infer it keeps a revision aimed at the customer even
    // when it is a rework of artwork they sent us.
    { storageKey, note, awaitingDecisionFrom: "customer" },
    requireAdminToken(),
  );
  revalidatePath(`/admin/jobs/${jobId}`);
}

/** Staff side of the proof round trip: sign off on, or push back, artwork the
 * customer submitted. The API refuses a decision aimed at the other party, so
 * this cannot be used to approve a proof that is sitting with the customer. */
export async function decideProofAction(formData: FormData) {
  const jobId = String(formData.get("jobId") || "");
  const proofId = String(formData.get("proofId") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("note") || "").trim();
  if (!jobId || !proofId) {
    throw new Error("Job and proof are required");
  }
  if (decision !== "approved" && decision !== "changes_requested") {
    throw new Error("Decision must be approved or changes_requested");
  }
  if (decision === "changes_requested" && !note) {
    throw new Error("Say what needs to change so the customer can act on it");
  }
  const client = await adminClient();
  await client.decideProof(
    jobId,
    proofId,
    { decision, note: note || undefined },
    { adminToken: requireAdminToken() },
  );
  revalidatePath("/admin/jobs");
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

export async function moveCategoryAction(
  categoryId: string,
  direction: "up" | "down",
) {
  const client = await adminClient();
  const token = requireAdminToken();
  const categories = await client.listCategories(token);
  const ids = categories.map((row) => String(row.id));
  const index = ids.indexOf(categoryId);
  if (index < 0) throw new Error("Category not found");
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= ids.length) return;
  const next = [...ids];
  const tmp = next[swapWith]!;
  next[swapWith] = next[index]!;
  next[index] = tmp;
  await client.reorderCategories(next, token);
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
  redirect(
    mappingListHref({
      tab: parseMappingTab(String(formData.get("returnTab") || "")),
      q: String(formData.get("returnQ") || ""),
      page: parsePage(String(formData.get("returnPage") || "")),
    }),
  );
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
  let mailed = "0";
  let slug = "";
  try {
    const client = await adminClient();
    const updated = await client.setStoreStatus(
      storeId,
      status,
      requireAdminToken(),
    );
    slug = updated.slug;
    if (status === "active" && updated.ownerEmail) {
      const origin = publicSiteOrigin();
      if (origin) {
        const mail = buildStoreApprovedEmail({
          storeName: updated.name,
          slug: updated.slug,
          origin,
          ownerName: updated.ownerName,
        });
        try {
          await sendEmail({
            to: updated.ownerEmail,
            subject: mail.subject,
            text: mail.text,
          });
          mailed = "1";
        } catch (sendFailure) {
          const detail =
            sendFailure instanceof Error
              ? sendFailure.message
              : "unknown email error";
          console.error(
            `[store-approve] Store ${updated.slug} is live but the owner was not emailed: ${detail}`,
          );
        }
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the store.";
    redirect(`/admin/accounts?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/${storeId}`);
  const notice = status === "active" ? "approved" : "rejected";
  redirect(
    `/admin/accounts?notice=${notice}&mailed=${mailed}&slug=${encodeURIComponent(slug)}`,
  );
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
