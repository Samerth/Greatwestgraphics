"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
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
  "application/pdf": "pdf",
};

export interface ProofUploadState {
  error?: string;
}
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
  notifyCustomer = true,
) {
  const client = await adminClient();
  await client.transitionJobRequest(
    jobId,
    toStatus,
    requireAdminToken(),
    reason,
    notifyCustomer,
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
  // This number becomes the Stripe charge verbatim. A dropped decimal or an
  // extra zero used to sail straight through to the customer's card, so a
  // large gap from the computed line total must be acknowledged on purpose.
  const amountMinor = Math.round(dollars * 100);
  const computedTotalMinor = Number(formData.get("computedTotalMinor") || "0");
  const confirmedOverride = formData.has("confirmOverride");
  if (
    Number.isFinite(computedTotalMinor) &&
    computedTotalMinor > 0 &&
    !confirmedOverride &&
    Math.abs(amountMinor - computedTotalMinor) / computedTotalMinor > 0.1
  ) {
    throw new Error(
      `Quote of $${(amountMinor / 100).toFixed(2)} is more than 10% away from the line total of $${(computedTotalMinor / 100).toFixed(2)}. Fix the amount, or tick the override box if this is intentional.`,
    );
  }

  const client = await adminClient();
  await client.createFinalQuote(
    jobId,
    {
     amountMinor,
      note,
      markAwaitingPayment,
    },
    requireAdminToken(),
  );
  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/quotes");
}

export async function createProofAction(
  _previous: ProofUploadState,
  formData: FormData,
): Promise<ProofUploadState> {
  await requireStaff();
  const jobId = String(formData.get("jobId") || "");
  const note = String(formData.get("note") || "") || undefined;
  const personId = String(formData.get("customerPersonId") || "");
  const file = formData.get("file");
  let storageKey = String(formData.get("storageKey") || "").trim();

  if (file instanceof File && file.size > 0) {
    const extension = PROOF_TYPES[file.type];
    if (!extension) {
      return { error: "Proof must be a PNG, JPG, SVG, or PDF" };
    }
    if (file.size > MAX_PROOF_BYTES) {
      return { error: "Proof file is too large — max 10MB" };
    }
    const owner = PERSON_ID_PATTERN.test(personId) ? personId : "staff";
    const key = `designs/${owner}/staff-${randomUUID()}.${extension}`;
    // The original UAT bug ("error page when uploading a design file") was
    // most likely this write — an S3/disk failure here used to throw
    // uncaught, crashing the page instead of showing the same inline error
    // banner as every other failure in this form.
    try {
      storageKey = await getImageStore().put(
        key,
        Buffer.from(await file.arrayBuffer()),
        file.type,
      );
    } catch (caught) {
      return {
        error:
          caught instanceof Error
            ? caught.message
            : "Could not upload the proof file. Please try again.",
      };
    }
  }

  if (!jobId || !storageKey) {
    return { error: "Job and a proof file are required" };
  }

  try {
    const client = await adminClient();
    await client.createProof(
      jobId,
      // A staff proof is always the customer's turn next. Naming it here rather
      // than letting the API infer it keeps a revision aimed at the customer even
      // when it is a rework of artwork they sent us.
      { storageKey, note, awaitingDecisionFrom: "customer" },
      requireAdminToken(),
    );
  } catch (caught) {
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "We could not attach the proof. Please try again.",
    };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return {};
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

export interface RunSyncState {
  error?: string;
  accepted?: boolean;
  vendor?: string;
  type?: "full" | "inventory";
}

export async function runSyncAction(
  _previous: RunSyncState,
  formData: FormData,
): Promise<RunSyncState> {
  await requireStaff();
  const vendor = String(formData.get("vendor") || "");
  const type = String(formData.get("type") || "");
  if (!vendor) {
    return { error: "Vendor is required." };
  }
  if (type !== "full" && type !== "inventory") {
    return { error: "Unknown sync type." };
  }
  try {
    const client = await adminClient();
    await client.runCatalogSync({ type, vendor }, requireAdminToken());
    // Recent runs on /admin/sync is polled by the client so a remount cannot
    // drop the Starting… state before sync_runs has a row.
    revalidatePath("/admin");
    return { accepted: true, vendor, type };
  } catch (caught) {
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "Could not start the catalog sync.",
      vendor,
      type,
    };
  }
}

export interface CsvImportState {
  error?: string;
  savedAt?: number;
}

export async function runCsvImportAction(
  _previous: CsvImportState,
  formData: FormData,
): Promise<CsvImportState> {
  const vendor = String(formData.get("vendor") || "csv");
  const vendorKey = String(formData.get("vendorKey") || "").trim() || undefined;
  const csvContent = String(formData.get("csvContent") || "");
  const csvProducts = String(formData.get("csvProducts") || "") || undefined;
  const csvSkus = String(formData.get("csvSkus") || "") || undefined;
  const mode = String(formData.get("mode") || "full");
  if (!csvContent.trim() && !(csvProducts && csvSkus)) {
    return { error: "Paste CSV content (or Sanmar products+skus pair)." };
  }
  try {
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
  } catch (caught) {
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "CSV import failed. Check the file format and try again.",
    };
  }
  revalidatePath("/admin/sync");
  revalidatePath("/admin");
  revalidatePath("/admin/catalog");
  updateTag("catalog-brands");
  updateTag("catalog-categories");
  return { savedAt: Date.now() };
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

export interface CategoryFormState {
  error?: string;
  savedAt?: number;
  /** Name last saved, so the success banner can name what happened
   *  ("Added \"T-Shirts\"") instead of a generic "Saved." — the specificity
   *  is what makes the confirmation register as real feedback rather than
   *  boilerplate the admin has learned to ignore. */
  name?: string;
}

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const name = String(formData.get("name") || "").trim();
  const slug = categorySlugFrom(String(formData.get("slug") || ""), name);
  const parentId = String(formData.get("parentId") || "").trim() || null;
  if (!name) return { error: "Category name is required" };
  if (!slug) {
    return { error: "Could not create a URL name from that category name" };
  }
  try {
    const client = await adminClient();
    await client.createCategory({ name, slug, parentId }, requireAdminToken());
  } catch (caught) {
    // This is the fix for the exact failure the client's team hit: the old
    // version threw here uncaught, and a plain <form action={...}> gives no
    // success feedback either — so a first, successful submit *looked* like
    // nothing happened, the admin clicked "Add a category" again with the
    // same name, and that second, genuinely duplicate submission crashed
    // the whole page instead of showing "already exists." Both halves are
    // fixed together: a real error now surfaces here instead of crashing,
    // and a real success now surfaces below instead of looking like nothing
    // happened in the first place.
    return {
      error:
        caught instanceof Error ? caught.message : "Could not add this category.",
    };
  }
  revalidatePath("/admin/categories");
  updateTag("catalog-categories");
  return { savedAt: Date.now(), name };
}

export async function updateCategoryAction(
  categoryId: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const name = String(formData.get("name") || "").trim();
  const slug = categorySlugFrom(String(formData.get("slug") || ""), name);
  const parentId = String(formData.get("parentId") || "").trim() || null;
  if (!name) return { error: "Category name is required" };
  if (!slug) {
    return { error: "Could not create a URL name from that category name" };
  }
  // Nothing checked reads as "unrestricted," not "allow nothing" — a fresh
  // category (or one nobody has ever restricted) must not silently lock
  // every decoration method/location out the first time this form saves.
  const allowedDecorationMethods = formData.getAll("allowedDecorationMethods");
  const allowedDecorationLocations = formData.getAll("allowedDecorationLocations");
  try {
    const client = await adminClient();
    await client.updateCategory(
      categoryId,
      {
        name,
        slug,
        parentId,
        allowedDecorationMethods:
          allowedDecorationMethods.length > 0
            ? allowedDecorationMethods.map(String)
            : null,
        allowedDecorationLocations:
          allowedDecorationLocations.length > 0
            ? allowedDecorationLocations.map(String)
            : null,
      },
      requireAdminToken(),
    );
  } catch (caught) {
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "Could not save this category.",
    };
  }
  revalidatePath("/admin/categories");
  updateTag("catalog-categories");
  return { savedAt: Date.now(), name };
}

/** Not a form: called from an inline server-action closure that already has
 *  the page's search/pagination state in scope, so a caught failure can
 *  redirect back to exactly where the admin was, with the reason attached,
 *  instead of dropping them on the generic error page mid-list. */
export async function deleteCategoryAction(categoryId: string) {
  const client = await adminClient();
  await client.deleteCategory(categoryId, requireAdminToken());
  revalidatePath("/admin/categories");
  updateTag("catalog-categories");
}

export async function reorderCategoryAction(orderedIds: string[]) {
  const client = await adminClient();
  await client.reorderCategories(orderedIds, requireAdminToken());
  revalidatePath("/admin/categories");
  updateTag("catalog-categories");
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
  updateTag("catalog-categories");
}

export async function saveMappingAction(formData: FormData) {
  const ssCategoryKey = String(formData.get("ssCategoryKey") || "");
  const ssCategoryLabel = String(formData.get("ssCategoryLabel") || "");
  const categoryIds = formData.getAll("categoryIds").map(String);
  const returnTo = {
    tab: parseMappingTab(String(formData.get("returnTab") || "")),
    q: String(formData.get("returnQ") || ""),
    page: parsePage(String(formData.get("returnPage") || "")),
  };
  try {
    const client = await adminClient();
    await client.putCategoryMapping(
      {
        ssCategoryKey,
        ssCategoryLabel: ssCategoryLabel || undefined,
        categoryIds,
      },
      requireAdminToken(),
    );
  } catch (caught) {
    // This form has no local error slot — it always navigates away on
    // submit — so a caught failure has to travel as a query param on the
    // same redirect it would have taken on success, or it is silently lost
    // and the admin just sees the list unchanged with no explanation.
    const message =
      caught instanceof Error ? caught.message : "Could not save this mapping.";
    redirect(mappingListHref({ ...returnTo, error: message }));
  }
  revalidatePath("/admin/categories/mappings");
  revalidatePath("/admin/catalog");
  redirect(mappingListHref(returnTo));
}

export interface PatchProductState {
  error?: string;
  savedAt?: number;
}

export async function patchProductAction(
  productId: string,
  _previous: PatchProductState,
  formData: FormData,
): Promise<PatchProductState> {
  const storefrontVisible = formData.has("storefrontVisible");
  const isDark = formData.has("isDark");
  const touchActive = formData.has("touchActive");
  const active = formData.has("active");
  const categoryIds = formData.getAll("categoryIds").map(String);
  try {
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
  } catch (caught) {
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "Could not save this product's storefront settings.",
    };
  }
  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${productId}`);
  updateTag("catalog-categories");
  return { savedAt: Date.now() };
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

/**
 * Not a real form (single "Refresh from vendor" button, no fields to keep
 * on error) — a caught failure redirects back to the product page with the
 * reason attached, matching `setStoreStatusAction` below, instead of
 * crashing to the generic error page as it did before this fix.
 */
export async function refreshCatalogProductAction(productId: string) {
  try {
    const client = await adminClient();
    await client.refreshCatalogProduct(productId, requireAdminToken());
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Could not refresh this product from the vendor.";
    redirect(`/admin/catalog/${productId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath("/admin/sync");
  updateTag("catalog-brands");
  redirect(`/admin/catalog/${productId}?notice=refreshed`);
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
  try {
    const client = await adminClient();
    await client.setStoreCategoryVisibility(
      storeId,
      categoryIds,
      requireAdminToken(),
    );
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Could not save this store's category visibility.";
    redirect(`/admin/accounts/${storeId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/admin/accounts/${storeId}`);
  updateTag("catalog-categories");
  redirect(`/admin/accounts/${storeId}?notice=categories-saved`);
}

export interface PricingAdjustmentState {
  error?: string;
  savedAt?: number;
}

export async function setStorePricingAdjustmentAction(
  storeId: string,
  _previous: PricingAdjustmentState,
  formData: FormData,
): Promise<PricingAdjustmentState> {
  const raw = String(formData.get("percent") ?? "").trim();
  const enteredPercent = raw === "" ? null : Number(raw);
  if (enteredPercent != null && !Number.isFinite(enteredPercent)) {
    return { error: "Pricing adjustment must be a number" };
  }
  // The form takes whole percentage points (the label and placeholder say
  // "-10 for 10% off"), but the API stores and applies a decimal fraction
  // (-0.1 for 10% off) — that's the unit `applyStorePricingAdjustment` and
  // `applyStorePricingAdjustmentV2` multiply straight into the pricing
  // config's multipliers. Convert here, once, at the boundary where the
  // human-facing number becomes the API's number.
  const percent = enteredPercent == null ? null : enteredPercent / 100;
  if (percent != null && (percent < -0.9 || percent > 2)) {
    return {
      error: "Pricing adjustment must be between -90 and 200 (percent).",
    };
  }
  try {
    const client = await adminClient();
    await client.setStorePricingAdjustment(
      storeId,
      percent,
      requireAdminToken(),
    );
  } catch (caught) {
    return {
      error:
        caught instanceof Error
          ? caught.message
          : "Could not save the pricing adjustment.",
    };
  }
  revalidatePath(`/admin/accounts/${storeId}`);
  return { savedAt: Date.now() };
}