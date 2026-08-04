"use client";

import { useMemo } from "react";
import CHARTS from "@/lib/data/size-charts.json";

export interface SizeChartProps {
  styleKey: string;
}

export function SizeChartTable({ styleKey }: SizeChartProps) {
  const chart = useMemo(() => {
    return (CHARTS as Record<string, unknown>)[styleKey] as {
      label: string;
      unit: string;
      measurements: Array<{ size: string; chest: string; length: string; sleeve: string }>;
      notes?: string;
    } | undefined;
  }, [styleKey]);

  if (!chart) {
    return (
      <div className="text-sm text-text-secondary italic p-sp-3">
        Size chart not available for this style. Contact us for measurements.
      </div>
    );
  }

  return (
    <div className="space-y-sp-3">
      <div>
        <h3 className="font-semibold text-sm mb-sp-2">{chart.label}</h3>
        <p className="text-xs text-text-tertiary mb-sp-3">
          All measurements in {chart.unit}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-text-primary">Size</th>
              <th className="text-left py-2 px-3 font-semibold text-text-primary">Chest</th>
              <th className="text-left py-2 px-3 font-semibold text-text-primary">Length</th>
              <th className="text-left py-2 px-3 font-semibold text-text-primary">Sleeve</th>
            </tr>
          </thead>
          <tbody>
            {chart.measurements.map((row, idx) => (
              <tr
                key={row.size}
                className={idx % 2 === 0 ? "bg-bg-raised/50" : ""}
              >
                <td className="py-2 px-3 font-semibold text-text-primary">{row.size}</td>
                <td className="py-2 px-3 text-text-secondary">{row.chest}</td>
                <td className="py-2 px-3 text-text-secondary">{row.length}</td>
                <td className="py-2 px-3 text-text-secondary">{row.sleeve}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chart.notes && (
        <div className="bg-bg-raised border border-border rounded-sm p-sp-3 text-xs text-text-secondary">
          <p className="font-semibold text-text-primary mb-1">📏 How to measure:</p>
          <p>{chart.notes}</p>
        </div>
      )}
    </div>
  );
}
