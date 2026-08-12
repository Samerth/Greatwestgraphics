"use client";

import { useMemo, useState } from "react";
import type { GarmentPricing, PricingConfigV2 } from "@gwg/contracts";
import { Button } from "@/components/shared/Button";
import {
  Field,
  GridNumberInput,
  MoneyField,
  NumberField,
  Panel,
  SelectField,
  ToggleField,
  dollarsToMinor,
  formatMoney,
} from "./fields";

type Props = {
  config: PricingConfigV2;
  onChange: (next: PricingConfigV2) => void;
};

const ROWS_PER_PAGE = 25;

/** Mirrors the engine: exact cost row, interpolated between quantity anchors. */
function lookupMarkup(
  grid: GarmentPricing["markupGrid"],
  costDollars: number,
  quantity: number,
): number {
  const rowIndex = Math.max(
    0,
    Math.min(
      grid.costAnchors.length - 1,
      grid.costAnchors.findIndex((anchor) => anchor >= costDollars),
    ),
  );
  const row = grid.grid[rowIndex] ?? [];
  const anchors = grid.qtyAnchors;

  if (quantity <= anchors[0]!) return row[0] ?? 1;
  const lastIndex = anchors.length - 1;
  if (quantity >= anchors[lastIndex]!) return row[lastIndex] ?? 1;

  let upper = anchors.findIndex((anchor) => anchor >= quantity);
  if (upper < 1) upper = 1;
  const lower = upper - 1;
  const span = anchors[upper]! - anchors[lower]!;
  const ratio = span === 0 ? 0 : (quantity - anchors[lower]!) / span;
  return row[lower]! + (row[upper]! - row[lower]!) * ratio;
}

export function GarmentTab({ config, onChange }: Props) {
  const [page, setPage] = useState(0);
  const [scalePercent, setScalePercent] = useState("0");
  const [probeCost, setProbeCost] = useState("8.00");
  const [probeQty, setProbeQty] = useState(24);

  const grid = config.garment.markupGrid;

  function setGarment<K extends keyof GarmentPricing>(
    key: K,
    value: GarmentPricing[K],
  ) {
    onChange({ ...config, garment: { ...config.garment, [key]: value } });
  }

  function setCell(rowIndex: number, colIndex: number, value: number) {
    const nextGrid = grid.grid.map((row) => [...row]);
    const row = nextGrid[rowIndex];
    if (!row) return;
    row[colIndex] = value;
    setGarment("markupGrid", { ...grid, grid: nextGrid });
  }

  function scaleAll(percent: number) {
    if (!percent) return;
    const factor = 1 + percent / 100;
    const nextGrid = grid.grid.map((row) =>
      row.map((value) => Math.round(value * factor * 100) / 100),
    );
    setGarment("markupGrid", { ...grid, grid: nextGrid });
  }

  const pageCount = Math.ceil(grid.costAnchors.length / ROWS_PER_PAGE);
  const firstRow = page * ROWS_PER_PAGE;
  const visibleRows = grid.costAnchors.slice(firstRow, firstRow + ROWS_PER_PAGE);

  const probe = useMemo(() => {
    const cost = Number.parseFloat(probeCost) || 0;
    const capDollars = config.garment.costCapForMarkupMinor / 100;
    const effectiveCost = config.garment.roundCostUpToWholeDollar
      ? Math.ceil(cost)
      : cost;
    const cappedCost = Math.min(effectiveCost, capDollars);
    const markup = lookupMarkup(grid, cappedCost, probeQty);
    const sellMinor = Math.round(
      dollarsToMinor(probeCost) * markup * config.garment.multiplier,
    );
    return { cost, effectiveCost, cappedCost, markup, sellMinor };
  }, [probeCost, probeQty, grid, config.garment]);

  return (
    <div className="space-y-sp-4">
      <Panel
        title="How garments are priced"
        description="Garment cost is looked up in the markup grid below. The grid replaces the old flat 2x markup, so cheap garments carry a higher markup than expensive ones and big runs are discounted automatically."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-sp-3">
          <NumberField
            label="Garment multiplier"
            hint="Global dial on top of the grid. 1.00 = grid as shown."
            value={config.garment.multiplier}
            step={0.01}
            onChange={(value) => setGarment("multiplier", value || 1)}
          />
          <MoneyField
            label="Cost cap for markup lookup"
            hint="Costs above this use the top row, so a $400 jacket isn't marked up like a $4 tee."
            valueMinor={config.garment.costCapForMarkupMinor}
            onChange={(minor) => setGarment("costCapForMarkupMinor", minor)}
          />
          <NumberField
            label="Catalog display quantity"
            hint={`Storefront "from" prices assume this quantity.`}
            value={config.garment.catalogDisplayQty}
            onChange={(value) =>
              setGarment("catalogDisplayQty", Math.max(1, Math.round(value)))
            }
          />
          <SelectField
            label="Vendor MAP handling"
            hint="What to do when a vendor sets a minimum advertised price."
            value={config.garment.mapPolicy}
            options={[
              { value: "warnOnly", label: "Warn staff, keep our price" },
              { value: "floor", label: "Raise our price to the MAP" },
              { value: "ignore", label: "Ignore MAP entirely" },
            ]}
            onChange={(value) => setGarment("mapPolicy", value)}
          />
          <div className="sm:col-span-2 flex items-end">
            <ToggleField
              label="Round cost up to the whole dollar before lookup"
              hint="Matches the estimator workbook: a $7.30 garment uses the $8 row."
              checked={config.garment.roundCostUpToWholeDollar}
              onChange={(checked) =>
                setGarment("roundCostUpToWholeDollar", checked)
              }
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Check a garment price"
        description="Type any cost and quantity to see exactly which grid cell is used and what the customer pays."
      >
        <div className="grid sm:grid-cols-3 gap-sp-3 items-end">
          <Field label="Garment cost">
            <input
              type="number"
              step="0.01"
              min="0"
              className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
              value={probeCost}
              onChange={(event) => setProbeCost(event.target.value)}
            />
          </Field>
          <NumberField
            label="Quantity"
            value={probeQty}
            onChange={(value) => setProbeQty(Math.max(1, Math.round(value)))}
          />
          <div className="border border-border rounded-sm p-sp-3 bg-bg">
            <p className="text-xs uppercase tracking-wide text-text-secondary m-0">
              Sell per piece
            </p>
            <p className="text-2xl font-display font-bold text-accent m-0">
              {formatMoney(probe.sellMinor)}
            </p>
          </div>
        </div>
        <ol className="text-sm text-text-secondary space-y-1 mt-sp-3 pl-5 list-decimal">
          <li>
            Cost {formatMoney(dollarsToMinor(probeCost))}
            {config.garment.roundCostUpToWholeDollar &&
              ` rounds up to $${probe.effectiveCost.toFixed(0)}`}
            {probe.cappedCost < probe.effectiveCost &&
              `, capped at $${probe.cappedCost.toFixed(0)}`}
          </li>
          <li>
            Grid row ${probe.cappedCost.toFixed(0)} at quantity {probeQty} gives
            a markup of {probe.markup.toFixed(3)}
            {!grid.qtyAnchors.includes(probeQty) &&
              " (interpolated between the neighbouring quantity columns)"}
          </li>
          <li>
            {formatMoney(dollarsToMinor(probeCost))} x{" "}
            {probe.markup.toFixed(3)}
            {config.garment.multiplier !== 1 &&
              ` x ${config.garment.multiplier} multiplier`}{" "}
            = {formatMoney(probe.sellMinor)}
          </li>
        </ol>
      </Panel>

      <Panel
        title="Markup grid"
        description="Rows are garment cost in whole dollars, columns are order quantity. Values are multipliers applied to cost."
        actions={
          <div className="flex items-end gap-2">
            <label className="text-sm">
              <span className="font-semibold block text-xs">Adjust all by</span>
              <input
                type="number"
                step="0.5"
                className="w-24 border border-border rounded-sm px-2 py-1 bg-bg"
                value={scalePercent}
                onChange={(event) => setScalePercent(event.target.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => scaleAll(Number.parseFloat(scalePercent) || 0)}
            >
              Apply %
            </Button>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary m-0">
            Showing costs ${visibleRows[0]} to $
            {visibleRows[visibleRows.length - 1]} of $
            {grid.costAnchors[grid.costAnchors.length - 1]}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-text-secondary">
              {page + 1} / {pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page >= pageCount - 1}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr>
                <th className="p-2 text-left sticky left-0 bg-bg-raised">
                  Cost
                </th>
                {grid.qtyAnchors.map((qty) => (
                  <th key={qty} className="p-2 font-semibold">
                    {qty}+
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((cost, offset) => {
                const rowIndex = firstRow + offset;
                return (
                  <tr key={cost} className="border-t border-border">
                    <td className="p-2 font-semibold sticky left-0 bg-bg-raised">
                      ${cost}
                    </td>
                    {grid.grid[rowIndex]?.map((value, colIndex) => (
                      <td key={colIndex} className="p-1">
                        <GridNumberInput
                          value={value}
                          title={`Cost $${cost} at qty ${grid.qtyAnchors[colIndex]}: sell $${(
                            (cost * value * config.garment.multiplier)
                          ).toFixed(2)}`}
                          onChange={(next) => setCell(rowIndex, colIndex, next)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-secondary m-0">
          Hover any cell to see the resulting sell price. Quantities between two
          columns are interpolated, so pricing moves smoothly rather than
          jumping at a break.
        </p>
      </Panel>
    </div>
  );
}
