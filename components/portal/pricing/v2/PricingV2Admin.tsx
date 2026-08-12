"use client";

import { useState, useTransition } from "react";
import type {
  PricingConfigV2,
  PricingConfigV2VersionSummary,
} from "@gwg/contracts";
import { Button } from "@/components/shared/Button";
import {
  publishPricingV2Action,
  restorePricingV2VersionAction,
  savePricingV2DraftAction,
} from "@/app/admin/pricing/v2/actions";
import { CalculatorTab } from "./CalculatorTab";
import { GarmentTab } from "./GarmentTab";
import { GlobalSettingsTab } from "./GlobalSettingsTab";
import { MethodsTab } from "./MethodsTab";
import { VersionsTab } from "./VersionsTab";

type TabId = "calculator" | "garment" | "methods" | "global" | "versions";

const TABS: ReadonlyArray<{ id: TabId; label: string; blurb: string }> = [
  {
    id: "calculator",
    label: "Calculator",
    blurb: "Price a sample order and see every step of the math",
  },
  {
    id: "garment",
    label: "Garments",
    blurb: "Markup grid by cost and quantity",
  },
  {
    id: "methods",
    label: "Decoration",
    blurb: "Rates, setup fees and surcharges per method",
  },
  {
    id: "global",
    label: "Order rules",
    blurb: "Rush, packing, freight, artwork and minimums",
  },
  {
    id: "versions",
    label: "History",
    blurb: "Published versions and rollback",
  },
];

type Props = {
  draft: PricingConfigV2;
  draftVersion: number;
  publishedConfig: PricingConfigV2 | null;
  versions: PricingConfigV2VersionSummary[];
  readOnlyReason?: string;
};

export function PricingV2Admin({
  draft,
  draftVersion,
  publishedConfig,
  versions,
  readOnlyReason,
}: Props) {
  const [config, setConfig] = useState<PricingConfigV2>(() =>
    structuredClone(draft),
  );
  const [savedConfig, setSavedConfig] = useState<PricingConfigV2>(() =>
    structuredClone(draft),
  );
  const [tab, setTab] = useState<TabId>("calculator");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  function run(action: () => Promise<string>) {
    startTransition(async () => {
      try {
        setMessage(await action());
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <div className="space-y-sp-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-sp-3">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            title={entry.blurb}
            onClick={() => setTab(entry.id)}
            className={`px-3 py-2 rounded-sm border text-sm font-bold ${
              tab === entry.id
                ? "bg-accent text-white border-accent"
                : "bg-bg-raised border-border hover:border-text-tertiary"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <span className="text-sm text-text-secondary ml-auto">
          Draft v{draftVersion}
          {publishedConfig
            ? ` · live v${publishedConfig.version}`
            : " · nothing published yet"}
          {isDirty && " · unsaved changes"}
        </span>
      </div>

      {readOnlyReason && (
        <p className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md p-sp-3 m-0 text-sm">
          {readOnlyReason}
        </p>
      )}

      <p className="text-sm text-text-secondary m-0">
        {TABS.find((entry) => entry.id === tab)?.blurb}
      </p>

      {tab === "calculator" && (
        <CalculatorTab config={config} publishedConfig={publishedConfig} />
      )}
      {tab === "garment" && (
        <GarmentTab config={config} onChange={setConfig} />
      )}
      {tab === "methods" && (
        <MethodsTab config={config} onChange={setConfig} />
      )}
      {tab === "global" && (
        <GlobalSettingsTab config={config} onChange={setConfig} />
      )}
      {tab === "versions" && (
        <VersionsTab
          versions={versions}
          pending={pending}
          onRestore={(version) =>
            run(async () => {
              await restorePricingV2VersionAction(version);
              return `Version ${version} is now the draft. Reload to edit it.`;
            })
          }
        />
      )}

      <div className="sticky bottom-0 bg-bg-raised border border-border rounded-md p-sp-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !isDirty}
          onClick={() =>
            run(async () => {
              await savePricingV2DraftAction(config);
              setSavedConfig(structuredClone(config));
              return "Draft saved. Nothing is live until you publish.";
            })
          }
        >
          {isDirty ? "Save draft" : "Draft saved"}
        </Button>

        <label className="text-sm flex-1 min-w-[220px]">
          <span className="sr-only">What changed</span>
          <input
            className="w-full border border-border rounded-sm px-3 py-2 bg-bg"
            placeholder="What changed? (saved with the published version)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              if (isDirty) {
                await savePricingV2DraftAction(config);
                setSavedConfig(structuredClone(config));
              }
              const published = await publishPricingV2Action(notes);
              setNotes("");
              return `Published v${published.version}. New quotes now use these prices.`;
            })
          }
        >
          Publish to live pricing
        </Button>

        {message && (
          <p className="text-sm text-text-secondary m-0 basis-full">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
