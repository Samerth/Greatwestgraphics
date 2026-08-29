"use client";

import { useState, type ReactNode } from "react";
import { GarmentSizeChartModal } from "@/components/shared/GarmentSizeChartModal";
import type { SizeSpecChart } from "@/lib/utils/size-specs";

/**
 * Opens the shared size-chart modal inline instead of navigating anywhere.
 * Used in two spots on the PDP -- next to "Sizes Available" up top (matching
 * the reference site's placement) and in the Sizing row of the specs panel
 * further down -- so both point at the same table without either one
 * scrolling to a `#size-chart` section that no longer exists on the page.
 */
export function PdpSizeChartTrigger({
  chart,
  productName,
  children,
  className,
}: {
  chart: SizeSpecChart;
  productName: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && (
        <GarmentSizeChartModal
          chart={chart}
          productName={productName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}