import type {
  PricingConfigV2,
  PricingConfigV2VersionSummary,
} from "@gwg/contracts";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import { PricingV2Admin } from "@/components/portal/pricing/v2/PricingV2Admin";
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

  const adminToken = process.env.DEV_ADMIN_TOKEN;

  try {
    if (!adminToken) {
      throw new Error(
        "DEV_ADMIN_TOKEN is not configured, so changes can't be saved. The numbers below are the imported defaults.",
      );
    }
    const client = await createCommerceClient();
    const [draftResponse, versionList] = await Promise.all([
      client.getPricingV2Draft(adminToken),
      client.listPricingV2Versions(adminToken),
    ]);
    draft = draftResponse.config;
    draftVersion = draftResponse.version;
    versions = versionList;

    try {
      publishedConfig = (await client.getPricingV2Published(adminToken)).config;
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
          Pricing engine v2
        </p>
        <h1 className="font-display font-bold text-3xl m-0">
          Pricing control panel
        </h1>
        <p className="text-text-secondary mt-2 mb-0 max-w-[70ch]">
          Everything that goes into a quote lives here. Edit freely — nothing
          reaches customers until you publish. Use the calculator to check any
          order before you do.
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
