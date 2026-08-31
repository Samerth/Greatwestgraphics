"use client";

import type { PricingConfigV2, PricingSettingsV2 } from "@gwg/contracts";
import {
  MoneyField,
  NumberField,
  Panel,
  PercentField,
  SelectField,
} from "./fields";

type Props = {
  config: PricingConfigV2;
  onChange: (next: PricingConfigV2) => void;
};

export function GlobalSettingsTab({ config, onChange }: Props) {
  function setSetting<K extends keyof PricingSettingsV2>(
    key: K,
    value: PricingSettingsV2[K],
  ) {
    onChange({
      ...config,
      settings: { ...config.settings, [key]: value },
    });
  }

  return (
    <div className="space-y-sp-4">
      <Panel
        title="Order rules"
        description="These apply to every quote, whatever is being decorated."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-sp-3">
          <NumberField
            label="Minimum order quantity"
            hint="Quotes below this are flagged for staff, not blocked."
            value={config.settings.minimumOrderQty}
            onChange={(value) =>
              setSetting("minimumOrderQty", Math.max(1, Math.round(value)))
            }
          />
          <NumberField
            label="Quote valid for (days)"
            hint="Shown on the quote and used for the expiry date."
            value={config.settings.quoteValidityDays}
            onChange={(value) =>
              setSetting("quoteValidityDays", Math.max(1, Math.round(value)))
            }
          />
          <PercentField
            label="Margin warning below"
            hint="Staff see a warning when a quote's gross margin drops under this."
            fraction={config.settings.marginWarningThreshold}
            onChange={(fraction) =>
              setSetting("marginWarningThreshold", Math.min(1, fraction))
            }
            max={100}
          />
        </div>
      </Panel>

      <Panel
        title="Rush, packing and freight"
        description="Rush is a percentage of the work being rushed. Freight is normally excluded because the carrier price doesn't change when we hurry."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-sp-3">
          <PercentField
            label="Rush fee"
            hint="Added on top of the rushed subtotal."
            fraction={config.settings.rushFeePercent}
            onChange={(fraction) => setSetting("rushFeePercent", fraction)}
          />
          <SelectField
            label="Rush applies to"
            value={config.settings.rushAppliesTo}
            options={[
              {
                value: "productionExcludingShipping",
                label: "Everything except shipping",
              },
              { value: "everything", label: "Everything including shipping" },
            ]}
            onChange={(value) => setSetting("rushAppliesTo", value)}
          />
          <MoneyField
            label="Packing fee per garment"
            hint="Charged only when individual polybagging is requested."
            valueMinor={config.settings.packingFeePerGarmentMinor}
            onChange={(minor) => setSetting("packingFeePerGarmentMinor", minor)}
          />
          <MoneyField
            label="Names/numbers fee per garment"
            hint="Charged only when the customer requests individual names/numbers."
            valueMinor={config.settings.namesNumbersFeePerGarmentMinor}
            onChange={(minor) => setSetting("namesNumbersFeePerGarmentMinor", minor)}
          />
          <PercentField
            label="Shipping markup"
            hint="Applied to the carrier cost to cover handling."
            fraction={config.settings.shippingMarkupPercent}
            onChange={(fraction) => setSetting("shippingMarkupPercent", fraction)}
          />
        </div>
      </Panel>

      <Panel
        title="Artwork and design"
        description="Charged once per quote, not per garment."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-sp-3">
          <MoneyField
            label="Artwork minimum fee"
            hint="Floor for any quote that needs art time. Waived when setup fees already cover it."
            valueMinor={config.settings.artworkMinimumFeeMinor}
            onChange={(minor) => setSetting("artworkMinimumFeeMinor", minor)}
          />
          <MoneyField
            label="Design hourly rate"
            hint="Billed per hour of design entered on the quote."
            valueMinor={config.settings.designHourlyRateMinor}
            onChange={(minor) => setSetting("designHourlyRateMinor", minor)}
          />
        </div>
      </Panel>

      <Panel
        title="Dark garment rule"
        description="Dark garments need an underbase, which several methods surcharge for. This decides how a garment is judged dark."
      >
        <div className="grid sm:grid-cols-2 gap-sp-3">
          <SelectField
            label="How dark is decided"
            value={config.settings.darkGarmentRule}
            options={[
              {
                value: "everythingExceptWhite",
                label: "Everything except white counts as dark",
              },
              {
                value: "explicit",
                label: "Only when staff tick the dark box",
              },
            ]}
            onChange={(value) => setSetting("darkGarmentRule", value)}
          />
        </div>
      </Panel>
    </div>
  );
}
