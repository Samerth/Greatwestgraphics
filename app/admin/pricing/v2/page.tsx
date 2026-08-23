import type {
  PricingConfigV2,
  PricingConfigV2VersionSummary,
} from "@gwg/contracts";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import { PricingV2Admin } from "@/components/portal/pricing/v2/PricingV2Admin";
import { adminToken } from "@/lib/admin/auth";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";

export const dynamic = "force-dynamic";

export default async function PricingV2Page() {
  let draft: PricingConfigV2 = PRICING_MASTER_V2;
  let draftVersion = 1;
  let publishedConfig: PricingConfigV2 | null = null;
  let versions: PricingConfigV2VersionSummary[] = [];
  let readOnlyReason: string | undefined;

  try {
    // Deployed environments set ADMIN_API_TOKEN, not DEV_ADMIN_TOKEN.
    const token = adminToken();
    const client = await createCommerceClient();
    const [draftResponse, versionList] = await Promise.all([
      client.getPricingV2Draft(token),
      client.listPricingV2Versions(token),
    ]);
    draft = draftResponse.config;
    draftVersion = draftResponse.version;
    versions = versionList;

    try {
      publishedConfig = (await client.getPricingV2Published(token)).config;
    } catch {
      // A tenant that has never published has no live config to compare against.
      publishedConfig = null;
    }
  } catch (caught) {
    readOnlyReason =
      caught instanceof CommerceApiError || caught instanceof Error
        ? caught.message
        : "Pricing admin is unavailable, showing imported defaults.";
  }

  return (
    <div className="space-y-sp-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Pricing strategy
        </p>
        <h1 className="font-display font-bold text-3xl m-0">
          How a garment is priced
        </h1>
        <p className="text-text-secondary mt-2 mb-0 max-w-[70ch]">
          Screen print, embroidery and DTF share one formula with the shop.
          Edit rates, setup (every job or per customer), thread fees and the
          shopper total here. Nothing goes live until you publish.
        </p>
      </div>

      <PricingV2Admin
        draft={draft}
        draftVersion={draftVersion}
        publishedConfig={publishedConfig}
        versions={versions}
        readOnlyReason={readOnlyReason}
      />
    </div>
  );
}
