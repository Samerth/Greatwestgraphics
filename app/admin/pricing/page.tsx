import { PricingAdmin } from "@/components/portal/pricing/PricingAdmin";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";
import type {
  PricingConfig,
  PricingConfigVersionSummary,
} from "@gwg/contracts";
import { DEFAULT_PRICING_CONFIG_V1 } from "@gwg/pricing";
import { adminToken } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  let draft: PricingConfig | undefined;
  let versions: PricingConfigVersionSummary[] = [];
  let error: string | undefined;

  try {
    // Deployed environments set ADMIN_API_TOKEN, not DEV_ADMIN_TOKEN. Reading
    // the dev variable directly is why this page showed only imported defaults
    // on staging while every other admin page worked.
    const token = adminToken();
    const client = (await createCommerceClient());
    const [draftResponse, versionList] = await Promise.all([
      client.getPricingDraft(token),
      client.listPricingVersions(token),
    ]);
    draft = draftResponse.config;
    versions = versionList;
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : caught instanceof Error
          ? caught.message
          : "Pricing admin is unavailable.";
    draft = DEFAULT_PRICING_CONFIG_V1;
  }

  return (
    <div className="space-y-sp-4 max-w-5xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Pricing engine
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Pricing</h1>
        <p className="text-text-secondary mt-2 mb-0 max-w-[64ch]">
          Edit draft levers, preview a sample quote, then publish. Storefront
          live pricing uses the published config only.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {draft && <PricingAdmin draft={draft} versions={versions} />}
    </div>
  );
}
