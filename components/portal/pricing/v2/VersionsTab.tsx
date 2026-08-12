"use client";

import type { PricingConfigV2VersionSummary } from "@gwg/contracts";
import { Button } from "@/components/shared/Button";
import { Panel } from "./fields";

type Props = {
  versions: PricingConfigV2VersionSummary[];
  pending: boolean;
  onRestore: (version: number) => void;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VersionsTab({ versions, pending, onRestore }: Props) {
  return (
    <Panel
      title="Published history"
      description="Every publish is kept. Quotes stay attached to the version that priced them, so restoring an old version never changes a quote that has already gone out."
    >
      {versions.length === 0 && (
        <p className="text-sm text-text-secondary m-0">
          Nothing published yet.
        </p>
      )}
      <ul className="space-y-2 m-0 p-0 list-none">
        {versions.map((version) => (
          <li
            key={version.id}
            className="border border-border rounded-sm px-sp-3 py-sp-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="text-sm">
              <p className="font-semibold m-0">
                Version {version.version}
                <span className="ml-2 text-xs uppercase tracking-wide text-text-secondary">
                  {version.status}
                </span>
              </p>
              <p className="text-text-secondary m-0">
                {version.notes || "No note recorded"}
              </p>
              <p className="text-text-secondary m-0 text-xs">
                {version.status === "draft"
                  ? `Updated ${formatDate(version.updatedAt)}`
                  : `Published ${formatDate(version.publishedAt)}`}
              </p>
            </div>
            {version.status !== "draft" && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onRestore(version.version)}
              >
                Copy into draft
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
