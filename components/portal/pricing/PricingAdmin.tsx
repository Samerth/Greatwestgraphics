"use client";

import { useMemo, useState, useTransition } from "react";
import type { PricingConfig, PricingConfigVersionSummary } from "@gwg/contracts";
import { calculateQuote } from "@gwg/pricing";
import { Button } from "@/components/shared/Button";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import {
  publishPricingDraftAction,
  restorePricingVersionAction,
  savePricingDraftAction,
} from "@/app/portal/pricing/actions";

type Props = {
  draft: PricingConfig;
  versions: PricingConfigVersionSummary[];
};

function dollarsFromMinor(minor: number) {
  return (minor / 100).toFixed(2);
}

function minorFromDollars(value: string): number {
  return Math.round(parseFloat(value || "0") * 100);
}

export function PricingAdmin({ draft, versions }: Props) {
  const [config, setConfig] = useState<PricingConfig>(structuredClone(draft));
  const [tab, setTab] = useState<"levers" | "tables" | "publish">("levers");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(
    () =>
      calculateQuote(
        {
          quantity: 24,
          garment: { unitCostMinor: 800, isDark: false },
          decorations: [
            {
              method: "screenPrint",
              location: "front",
              colours: 3,
              isOversized: false,
              isRepeatArtwork: false,
            },
          ],
          options: {
            rush: false,
            designHours: 0,
            includePacking: false,
            shippingCostMinor: 0,
          },
          needsArtworkReview: false,
        },
        config,
      ),
    [config],
  );

  function updateMultiplier(
    key: keyof PricingConfig["multipliers"],
    value: string,
  ) {
    setConfig((prev) => ({
      ...prev,
      multipliers: { ...prev.multipliers, [key]: Number(value) || 0 },
    }));
  }

  function updateSettingMinor(
    key: keyof PricingConfig["settings"],
    value: string,
  ) {
    setConfig((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]:
          typeof prev.settings[key] === "number" &&
          String(key).endsWith("Minor")
            ? minorFromDollars(value)
            : key === "minimumOrderQty"
              ? Number(value) || 1
              : Number(value) || 0,
      },
    }));
  }

  return (
    <div className="space-y-sp-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["levers", "Level 1 — Quick levers"],
            ["tables", "Level 2 — Price tables"],
            ["publish", "Level 3 — Publish"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-2 rounded-sm border text-sm font-bold ${
              tab === id
                ? "bg-accent text-white border-accent"
                : "bg-bg-raised border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "levers" && (
        <div className="grid md:grid-cols-2 gap-sp-4">
          <section className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-3">
            <h2 className="font-display font-bold text-lg m-0">Multipliers</h2>
            <p className="text-sm text-text-secondary m-0">
              1.00 = current pricing. 0.95 = 5% lower. 1.05 = 5% higher.
            </p>
            {(
              Object.keys(config.multipliers) as Array<
                keyof PricingConfig["multipliers"]
              >
            ).map((key) => (
              <label key={key} className="block text-sm">
                <span className="font-semibold">{key}</span>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full border border-border rounded-sm px-3 py-2"
                  value={config.multipliers[key]}
                  onChange={(e) => updateMultiplier(key, e.target.value)}
                />
              </label>
            ))}
          </section>
          <section className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-3">
            <h2 className="font-display font-bold text-lg m-0">Fees</h2>
            {(
              [
                ["setupFeeNewPerColourMinor", "New setup / colour"],
                ["setupFeeRepeatPerColourMinor", "Repeat setup / colour"],
                ["artworkMinimumFeeMinor", "Artwork minimum"],
                ["designHourlyRateMinor", "Design hourly rate"],
                ["oversizedSurchargePerLocationMinor", "Oversized surcharge"],
                ["packingFeePerGarmentMinor", "Packing / garment"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="font-semibold">{label}</span>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full border border-border rounded-sm px-3 py-2"
                  value={dollarsFromMinor(config.settings[key])}
                  onChange={(e) => updateSettingMinor(key, e.target.value)}
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="font-semibold">Rush fee %</span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full border border-border rounded-sm px-3 py-2"
                value={config.settings.rushFeePercent}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      rushFeePercent: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Shipping markup %</span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full border border-border rounded-sm px-3 py-2"
                value={config.settings.shippingMarkupPercent}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      shippingMarkupPercent: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Minimum order qty</span>
              <input
                type="number"
                className="mt-1 w-full border border-border rounded-sm px-3 py-2"
                value={config.settings.minimumOrderQty}
                onChange={(e) =>
                  updateSettingMinor("minimumOrderQty", e.target.value)
                }
              />
            </label>
          </section>
        </div>
      )}

      {tab === "tables" && (
        <div className="space-y-sp-4">
          <section className="border border-border rounded-md p-sp-4 bg-bg-raised overflow-x-auto">
            <h2 className="font-display font-bold text-lg mb-sp-2">
              Screen print (cents shown as dollars)
            </h2>
            <table className="text-sm border-collapse min-w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Colours</th>
                  {config.screenPrintMatrix.qtyTiers.map((tier, idx) => (
                    <th key={idx} className="p-2">
                      {tier.min}-{tier.max ?? "+"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(config.screenPrintMatrix.pricesByColour).map(
                  ([colour, prices]) => (
                    <tr key={colour}>
                      <td className="p-2 font-semibold">{colour}</td>
                      {prices.map((price, idx) => (
                        <td key={idx} className="p-1">
                          <input
                            className="w-20 border border-border rounded-sm px-1 py-1"
                            value={dollarsFromMinor(price)}
                            onChange={(e) => {
                              const next = [...prices];
                              next[idx] = minorFromDollars(e.target.value);
                              setConfig((prev) => ({
                                ...prev,
                                screenPrintMatrix: {
                                  ...prev.screenPrintMatrix,
                                  pricesByColour: {
                                    ...prev.screenPrintMatrix.pricesByColour,
                                    [colour]: next,
                                  },
                                },
                              }));
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </section>

          <section className="border border-border rounded-md p-sp-4 bg-bg-raised overflow-x-auto">
            <h2 className="font-display font-bold text-lg mb-sp-2">
              Garment markup anchors
            </h2>
            <p className="text-sm text-text-secondary mb-sp-2">
              Values between anchors are calculated automatically.
            </p>
            <table className="text-sm border-collapse min-w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left">Cost $</th>
                  {config.garmentMarkup.qtyAnchors.map((qty) => (
                    <th key={qty} className="p-2">
                      {qty}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.garmentMarkup.costAnchors.map((cost, rowIdx) => (
                  <tr key={cost}>
                    <td className="p-2 font-semibold">{cost}</td>
                    {config.garmentMarkup.grid[rowIdx]?.map((value, colIdx) => (
                      <td key={colIdx} className="p-1">
                        <input
                          className="w-16 border border-border rounded-sm px-1 py-1"
                          value={value}
                          onChange={(e) => {
                            const grid = config.garmentMarkup.grid.map((row) => [
                              ...row,
                            ]);
                            grid[rowIdx]![colIdx] = Number(e.target.value) || 0;
                            setConfig((prev) => ({
                              ...prev,
                              garmentMarkup: { ...prev.garmentMarkup, grid },
                            }));
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === "publish" && (
        <div className="grid md:grid-cols-2 gap-sp-4">
          <section className="border border-border rounded-md p-sp-4 bg-bg-raised">
            <h2 className="font-display font-bold text-lg">Preview calculator</h2>
            <p className="text-sm text-text-secondary">
              Fixed sample: 24 light tees @ $8, front 3-colour screen print.
            </p>
            <p className="text-2xl font-display font-bold text-accent mt-sp-3">
              {moneyFromMinor(preview.totalMinor)}
            </p>
            <p className="text-sm">
              Per piece {moneyFromMinor(preview.perPieceMinor)} · Setup{" "}
              {moneyFromMinor(preview.oneTimeFeesMinor)}
            </p>
          </section>
          <section className="border border-border rounded-md p-sp-4 bg-bg-raised">
            <h2 className="font-display font-bold text-lg">Version history</h2>
            <ul className="space-y-2 mt-sp-2">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex items-center justify-between gap-2 text-sm border border-border rounded-sm px-3 py-2"
                >
                  <span>
                    v{version.version} · {version.status}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await restorePricingVersionAction(version.version);
                          setMessage(`Restored v${version.version} as draft`);
                        } catch (error) {
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "Restore failed",
                          );
                        }
                      })
                    }
                  >
                    Restore as draft
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await savePricingDraftAction(config);
                setMessage("Draft saved");
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Save failed",
                );
              }
            })
          }
        >
          Save draft
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await savePricingDraftAction(config);
                await publishPricingDraftAction();
                setMessage("Published new pricing version");
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Publish failed",
                );
              }
            })
          }
        >
          Preview & publish
        </Button>
        {message && <p className="text-sm text-text-secondary m-0">{message}</p>}
      </div>
    </div>
  );
}
