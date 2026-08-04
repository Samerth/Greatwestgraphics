"use client";

import { useState, useMemo } from "react";
import { SizeChartModal } from "./SizeChartModal";
import { getSizeChartKey, hasSizeChart } from "@/lib/utils/size-chart-key";

export interface ProductSizeGuideProps {
  brandName?: string;
  styleName?: string;
  productName: string;
}

/**
 * Size guide section for product page. Shows a button that opens
 * the size chart modal when clicked (only if a chart exists for this style).
 */
export function ProductSizeGuide({
  brandName,
  styleName,
  productName,
}: ProductSizeGuideProps) {
  const [showModal, setShowModal] = useState(false);

  const chartKey = useMemo(() => getSizeChartKey(brandName, styleName), [brandName, styleName]);
  const hasChart = useMemo(() => hasSizeChart(chartKey), [chartKey]);

  if (!hasChart || !chartKey) {
    return null;
  }

  return (
    <>
      <div className="mt-sp-4 pt-sp-4 border-t border-border">
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border text-text-primary hover:border-text-tertiary hover:bg-bg-raised transition-colors text-sm font-semibold"
        >
          <span>📏</span>
          View size chart
        </button>
      </div>

      {showModal && (
        <SizeChartModal
          styleKey={chartKey}
          productName={productName}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
