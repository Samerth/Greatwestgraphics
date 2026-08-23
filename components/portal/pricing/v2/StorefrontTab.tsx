"use client";

import { useMemo, useState } from "react";
import type { PricingConfigV2, StorefrontPricing } from "@gwg/contracts";
import { priceShopperItem } from "@gwg/pricing";
import {
  Field,
  MoneyField,
  NumberField,
  Panel,
  SelectField,
  ToggleField,
  formatMoney,
} from "./fields";

type Props = {
  config: PricingConfigV2;
  onChange: (next: PricingConfigV2) => void;
};

const STOREFRONT_FALLBACK = {
  unitPriceIncludes: "blank" as const,
  defaultMethodKey: "screenPrint",
  defaultLocation: "front",
  defaultColours: 1,
  defaultStitchCount: 5000,
  defaultOptionKey: "medium",
  assumeNewArtwork: true,
  assumeDarkGarment: false,
};

export function StorefrontTab({ config, onChange }: Props) {
  const storefront = config.storefront ?? STOREFRONT_FALLBACK;

  function setStorefront<K extends keyof StorefrontPricing>(
    key: K,
    value: StorefrontPricing[K],
  ) {
    onChange({
      ...config,
      storefront: { ...storefront, [key]: value },
    });
  }

  return (
    <div className="space-y-sp-4">
      <Panel
        title="What the shopper sees"
        description="The storefront uses this published config and the same formula as the calculator. Shoppers only see the total; this screen is where you decide what that total includes."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-sp-3">
          <SelectField
            label="Shopper unit price includes"
            hint="Blank is garment only. Decorated adds the default print. Landed also amortizes setup."
            value={storefront.unitPriceIncludes}
            options={[
              { value: "blank", label: "Garment only" },
              { value: "decorated", label: "Garment + decoration" },
              { value: "landed", label: "Garment + decoration + setup" },
            ]}
            onChange={(value) => setStorefront("unitPriceIncludes", value)}
          />
          <SelectField
            label="Default decoration method"
            value={storefront.defaultMethodKey}
            options={config.methods.map((method) => ({
              value: method.key,
              label: method.label,
            }))}
            onChange={(value) => setStorefront("defaultMethodKey", value)}
          />
          <NumberField
            label="Catalog display quantity"
            hint={`Tiles and "from" prices assume this quantity.`}
            value={config.garment.catalogDisplayQty}
            onChange={(value) =>
              onChange({
                ...config,
                garment: {
                  ...config.garment,
                  catalogDisplayQty: Math.max(1, Math.round(value)),
                },
              })
            }
          />
          <NumberField
            label="Default ink colours"
            value={storefront.defaultColours}
            onChange={(value) =>
              setStorefront("defaultColours", Math.max(1, Math.round(value)))
            }
          />
          <NumberField
            label="Default stitch count"
            value={storefront.defaultStitchCount}
            onChange={(value) =>
              setStorefront(
                "defaultStitchCount",
                Math.max(0, Math.round(value)),
              )
            }
          />
          <Field label="Default DTF size">
            <input
              className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
              value={storefront.defaultOptionKey}
              onChange={(event) =>
                setStorefront("defaultOptionKey", event.target.value)
              }
            />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-sp-3 mt-sp-3">
          <ToggleField
            label="Assume new artwork on advertised prices"
            hint="Turn off to preview returning-customer (no digitizing) prices on tiles."
            checked={storefront.assumeNewArtwork}
            onChange={(checked) =>
              setStorefront("assumeNewArtwork", checked)
            }
          />
          <ToggleField
            label="Assume dark garment on advertised prices"
            checked={storefront.assumeDarkGarment}
            onChange={(checked) =>
              setStorefront("assumeDarkGarment", checked)
            }
          />
        </div>
      </Panel>

      <ShopperPreview config={config} />
    </div>
  );
}

function ShopperPreview({ config }: { config: PricingConfigV2 }) {
  const storefront = config.storefront ?? STOREFRONT_FALLBACK;
  const methods = config.methods.filter((method) => method.enabled);
  const [unitCostMinor, setUnitCostMinor] = useState(800);
  const [quantity, setQuantity] = useState(config.garment.catalogDisplayQty);
  const [methodKey, setMethodKey] = useState(storefront.defaultMethodKey);
  const [colours, setColours] = useState(storefront.defaultColours);
  const [stitchCount, setStitchCount] = useState(storefront.defaultStitchCount);
  const [optionKey, setOptionKey] = useState(storefront.defaultOptionKey);
  const [mapPriceMinor, setMapPriceMinor] = useState(0);

  const method = methods.find((entry) => entry.key === methodKey) ?? methods[0];
  const sample = useMemo(
    () =>
      priceShopperItem(config, {
        unitCostMinor,
        quantity: Math.max(1, quantity),
        colourName: storefront.assumeDarkGarment ? "Navy" : "White",
        isDark: storefront.assumeDarkGarment,
        methodKey: method?.key,
        colours,
        stitchCount,
        optionKey,
        mapPriceMinor: mapPriceMinor > 0 ? mapPriceMinor : null,
        decorated: true,
      }),
    [
      colours,
      config,
      mapPriceMinor,
      method?.key,
      optionKey,
      quantity,
      stitchCount,
      storefront.assumeDarkGarment,
      unitCostMinor,
    ],
  );
  const { summary } = sample;

  return (
    <Panel
      title="Advertised price preview"
      description="Pick a garment, quantity and method. Shoppers see the unit total; the lines below are the same math the calculator uses."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-sp-3 mb-sp-4">
        <MoneyField
          label="Vendor cost"
          valueMinor={unitCostMinor}
          onChange={setUnitCostMinor}
        />
        <NumberField
          label="Quantity"
          value={quantity}
          onChange={(value) => setQuantity(Math.max(1, Math.round(value)))}
        />
        <SelectField
          label="Method"
          value={method?.key ?? ""}
          options={methods.map((entry) => ({
            value: entry.key,
            label: entry.label,
          }))}
          onChange={setMethodKey}
        />
        {method?.rateModel.kind === "matrixByColour" && (
          <NumberField
            label="Ink colours"
            value={colours}
            onChange={(value) => setColours(Math.max(1, Math.round(value)))}
          />
        )}
        {method?.rateModel.kind === "baseWithVariable" && (
          <NumberField
            label="Stitch count"
            value={stitchCount}
            onChange={(value) => setStitchCount(Math.max(0, Math.round(value)))}
          />
        )}
        {method?.rateModel.kind === "matrixByOption" && (
          <SelectField
            label="DTF size"
            value={optionKey}
            options={method.rateModel.options.map((option) => ({
              value: option.key,
              label: option.label,
            }))}
            onChange={setOptionKey}
          />
        )}
        <MoneyField
          label="Vendor MAP"
          hint="Optional. Used when MAP policy is floor or warn."
          valueMinor={mapPriceMinor}
          onChange={setMapPriceMinor}
        />
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm m-0">
        <Row label="Vendor cost" value={formatMoney(summary.costMinor)} />
        <Row label="Markup" value={`${summary.markup.toFixed(3)}×`} />
        <Row label="Garment" value={formatMoney(summary.garmentMinor)} />
        <Row
          label="Decoration"
          value={formatMoney(summary.decorationMinor)}
        />
        <Row label="Setup" value={formatMoney(summary.setupMinor)} />
        <Row label="Thread" value={formatMoney(summary.threadMinor)} />
        <Row label="Quantity" value={String(summary.quantity)} />
        <Row
          label="MAP"
          value={
            summary.mapPriceMinor
              ? `${formatMoney(summary.mapPriceMinor)}${summary.mapApplied ? " (applied)" : ""}`
              : "—"
          }
        />
        <Row label="Advertised total" value={formatMoney(summary.totalMinor)} />
      </dl>
      <p className="text-3xl font-display font-bold text-accent m-0 mt-sp-3">
        {formatMoney(summary.unitMinor)}
        <span className="text-base font-semibold text-text-secondary">
          {" "}
          / piece
        </span>
      </p>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="m-0 font-semibold">{value}</dd>
    </div>
  );
}
