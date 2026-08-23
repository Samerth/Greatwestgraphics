"use client";

import { useState } from "react";
import type {
  DecorationMethodConfig,
  PricingConfigV2,
  RateModel,
  Surcharge,
} from "@gwg/contracts";
import { Button } from "@/components/shared/Button";
import {
  Field,
  GridMoneyInput,
  MoneyField,
  NumberField,
  PercentField,
  SelectField,
  ToggleField,
  dollarsToMinor,
  formatMoney,
  minorToDollars,
} from "./fields";

type Props = {
  config: PricingConfigV2;
  onChange: (next: PricingConfigV2) => void;
};

/** Every rate array in a model is column-aligned with qtyAnchors. */
function mapRateArrays(
  model: RateModel,
  transform: (values: number[]) => number[],
): RateModel {
  switch (model.kind) {
    case "matrixByColour":
      return {
        ...model,
        ratesByColour: Object.fromEntries(
          Object.entries(model.ratesByColour).map(([key, values]) => [
            key,
            transform(values),
          ]),
        ),
      };
    case "matrixByOption":
      return {
        ...model,
        ratesByOption: Object.fromEntries(
          Object.entries(model.ratesByOption).map(([key, values]) => [
            key,
            transform(values),
          ]),
        ),
      };
    case "baseWithVariable":
      return {
        ...model,
        baseMinor: transform(model.baseMinor),
        extraPerUnitMinor: transform(model.extraPerUnitMinor),
      };
    case "flatByQty":
      return { ...model, ratesMinor: transform(model.ratesMinor) };
  }
}

function newMethodTemplate(index: number): DecorationMethodConfig {
  return {
    key: `method${index}`,
    label: "New decoration method",
    description: "",
    enabled: false,
    sortOrder: index,
    multiplier: 1,
    rateModel: {
      kind: "flatByQty",
      qtyAnchors: [1, 12, 24, 48, 72, 144, 288],
      ratesMinor: [1200, 900, 700, 600, 500, 450, 400],
    },
    setup: {
      label: "Setup",
      description: "",
      newFeeMinor: 3000,
      repeatFeeMinor: 0,
      per: "design",
      frequency: "perJob",
      shareAcrossGarments: true,
      multiplierApplies: false,
      repeatRequiresVerification: true,
    },
    threadFee: {
      enabled: false,
      label: "Thread fee",
      description: "",
      kind: "flatPerJob",
      amountMinor: 0,
      multiplierApplies: false,
    },
    minimumChargePerLocationMinor: 0,
    surcharges: [],
    costModel: { runCostRatio: 0.4, setupCostRatio: 0.2 },
  };
}

export function MethodsTab({ config, onChange }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(
    config.methods[0]?.key ?? null,
  );

  function updateMethod(index: number, next: DecorationMethodConfig) {
    const methods = [...config.methods];
    methods[index] = next;
    onChange({ ...config, methods });
  }

  function addMethod() {
    const method = newMethodTemplate(config.methods.length + 1);
    onChange({ ...config, methods: [...config.methods, method] });
    setOpenKey(method.key);
  }

  function removeMethod(index: number) {
    if (config.methods.length <= 1) return;
    const methods = config.methods.filter((_, i) => i !== index);
    onChange({ ...config, methods });
  }

  return (
    <div className="space-y-sp-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-text-secondary m-0 max-w-[70ch]">
          Each method carries its own rate table, setup fees and surcharges.
          Adding a method here makes it quotable everywhere without a code
          change. Disabled methods stay saved but can&apos;t be quoted.
        </p>
        <Button type="button" size="sm" onClick={addMethod}>
          Add method
        </Button>
      </div>

      {config.methods.map((method, index) => (
        <MethodEditor
          key={method.key}
          method={method}
          isOpen={openKey === method.key}
          onToggleOpen={() =>
            setOpenKey(openKey === method.key ? null : method.key)
          }
          onChange={(next) => updateMethod(index, next)}
          onRemove={
            config.methods.length > 1 ? () => removeMethod(index) : undefined
          }
        />
      ))}
    </div>
  );
}

function MethodEditor({
  method,
  isOpen,
  onToggleOpen,
  onChange,
  onRemove,
}: {
  method: DecorationMethodConfig;
  isOpen: boolean;
  onToggleOpen: () => void;
  onChange: (next: DecorationMethodConfig) => void;
  onRemove?: () => void;
}) {
  const anchors = method.rateModel.qtyAnchors;

  function setRateModel(model: RateModel) {
    onChange({ ...method, rateModel: model });
  }

  function setAnchor(colIndex: number, value: number) {
    const qtyAnchors = [...anchors];
    qtyAnchors[colIndex] = Math.max(1, Math.round(value));
    setRateModel({ ...method.rateModel, qtyAnchors } as RateModel);
  }

  function addColumn() {
    const last = anchors[anchors.length - 1] ?? 1;
    const model = mapRateArrays(method.rateModel, (values) => [
      ...values,
      values[values.length - 1] ?? 0,
    ]);
    setRateModel({ ...model, qtyAnchors: [...anchors, last * 2] } as RateModel);
  }

  function removeColumn(colIndex: number) {
    if (anchors.length <= 2) return;
    const model = mapRateArrays(method.rateModel, (values) =>
      values.filter((_, i) => i !== colIndex),
    );
    setRateModel({
      ...model,
      qtyAnchors: anchors.filter((_, i) => i !== colIndex),
    } as RateModel);
  }

  return (
    <section className="border border-border rounded-md bg-bg-raised overflow-hidden">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between gap-3 p-sp-4 text-left"
      >
        <span>
          <span className="font-display font-bold text-lg block">
            {method.label}
            {!method.enabled && (
              <span className="ml-2 text-xs uppercase tracking-wide text-text-secondary">
                disabled
              </span>
            )}
          </span>
          <span className="text-sm text-text-secondary">
            {describeModel(method.rateModel)} · setup{" "}
            {formatMoney(method.setup.newFeeMinor)} per {method.setup.per}
            {method.multiplier !== 1 && ` · multiplier ${method.multiplier}`}
          </span>
        </span>
        <span className="text-sm text-text-secondary">
          {isOpen ? "Hide" : "Edit"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border p-sp-4 space-y-sp-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-sp-3">
            <Field label="Name shown to staff">
              <input
                className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
                value={method.label}
                onChange={(event) =>
                  onChange({ ...method, label: event.target.value })
                }
              />
            </Field>
            <Field
              label="Key"
              hint="Used by quotes and the API. Changing it breaks saved quotes."
            >
              <input
                className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg font-mono text-sm"
                value={method.key}
                onChange={(event) =>
                  onChange({ ...method, key: event.target.value })
                }
              />
            </Field>
            <NumberField
              label="Method multiplier"
              hint="Dial the whole method up or down. 1.00 = table as shown."
              value={method.multiplier}
              step={0.01}
              onChange={(value) =>
                onChange({ ...method, multiplier: value || 1 })
              }
            />
            <MoneyField
              label="Minimum charge per location"
              hint="Floor on the run charge before surcharges."
              valueMinor={method.minimumChargePerLocationMinor}
              onChange={(minor) =>
                onChange({ ...method, minimumChargePerLocationMinor: minor })
              }
            />
          </div>

          <ToggleField
            label="Available for quoting"
            checked={method.enabled}
            onChange={(checked) => onChange({ ...method, enabled: checked })}
          />

          <div className="space-y-sp-2">
            <h4 className="font-display font-bold m-0">
              Run rates by quantity
            </h4>
            <p className="text-sm text-text-secondary m-0">
              Prices are per piece, per location. A quantity between two columns
              is priced on a straight line between them; past the last column
              the rate stays flat.
            </p>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse min-w-full">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Quantity</th>
                    {anchors.map((anchor, colIndex) => (
                      <th key={colIndex} className="p-1 text-center">
                        <input
                          type="number"
                          min="1"
                          className="w-20 border border-border rounded-sm px-2 py-1 bg-bg font-semibold"
                          value={anchor}
                          onChange={(event) =>
                            setAnchor(
                              colIndex,
                              Number.parseFloat(event.target.value) || 1,
                            )
                          }
                        />
                        {anchors.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeColumn(colIndex)}
                            className="block mx-auto mt-1 text-xs text-text-secondary hover:text-accent"
                          >
                            remove
                          </button>
                        )}
                      </th>
                    ))}
                    <th className="p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={addColumn}
                      >
                        + Break
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <RateModelRows
                    model={method.rateModel}
                    onChange={setRateModel}
                  />
                </tbody>
              </table>
            </div>
            {method.rateModel.kind === "baseWithVariable" && (
              <VariableSettings
                model={method.rateModel}
                onChange={setRateModel}
              />
            )}
          </div>

          <SetupEditor
            method={method}
            onChange={(setup) => onChange({ ...method, setup })}
          />

          <ThreadFeeEditor
            method={method}
            onChange={(threadFee) => onChange({ ...method, threadFee })}
          />

          <SurchargeEditor
            surcharges={method.surcharges}
            onChange={(surcharges) => onChange({ ...method, surcharges })}
          />

          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">
              Internal cost estimates (margin reporting only)
            </summary>
            <div className="grid sm:grid-cols-2 gap-sp-3 mt-sp-3">
              <PercentField
                label="Run cost as % of price"
                hint="Ink, film, labour. Only affects the margin shown to staff."
                fraction={method.costModel.runCostRatio}
                onChange={(fraction) =>
                  onChange({
                    ...method,
                    costModel: {
                      ...method.costModel,
                      runCostRatio: Math.min(1, fraction),
                    },
                  })
                }
                max={100}
              />
              <PercentField
                label="Setup cost as % of setup fee"
                fraction={method.costModel.setupCostRatio}
                onChange={(fraction) =>
                  onChange({
                    ...method,
                    costModel: {
                      ...method.costModel,
                      setupCostRatio: Math.min(1, fraction),
                    },
                  })
                }
                max={100}
              />
            </div>
          </details>

          {onRemove && (
            <div className="pt-sp-2 border-t border-border">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onRemove}
              >
                Delete this method
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function describeModel(model: RateModel): string {
  switch (model.kind) {
    case "matrixByColour":
      return `Rate per colour count (${model.minColours}-${model.maxColours} colours)`;
    case "baseWithVariable":
      return `Base rate plus ${model.variable.label.toLowerCase()}`;
    case "matrixByOption":
      return `Rate per ${model.options.length} size options`;
    case "flatByQty":
      return "Single rate per quantity";
  }
}

function RateModelRows({
  model,
  onChange,
}: {
  model: RateModel;
  onChange: (model: RateModel) => void;
}) {
  if (model.kind === "matrixByColour") {
    return (
      <>
        {Object.entries(model.ratesByColour).map(([colour, rates]) => (
          <tr key={colour} className="border-t border-border">
            <td className="p-2 font-semibold whitespace-nowrap">
              {colour} colour{colour === "1" ? "" : "s"}
            </td>
            {rates.map((rate, colIndex) => (
              <td key={colIndex} className="p-1">
                <GridMoneyInput
                  valueMinor={rate}
                  onChange={(minor) => {
                    const next = [...rates];
                    next[colIndex] = minor;
                    onChange({
                      ...model,
                      ratesByColour: {
                        ...model.ratesByColour,
                        [colour]: next,
                      },
                    });
                  }}
                />
              </td>
            ))}
            <td />
          </tr>
        ))}
      </>
    );
  }

  if (model.kind === "matrixByOption") {
    return (
      <>
        {model.options.map((option) => {
          const rates = model.ratesByOption[option.key] ?? [];
          return (
            <tr key={option.key} className="border-t border-border">
              <td className="p-2 font-semibold whitespace-nowrap">
                {option.label}
              </td>
              {rates.map((rate, colIndex) => (
                <td key={colIndex} className="p-1">
                  <GridMoneyInput
                    valueMinor={rate}
                    onChange={(minor) => {
                      const next = [...rates];
                      next[colIndex] = minor;
                      onChange({
                        ...model,
                        ratesByOption: {
                          ...model.ratesByOption,
                          [option.key]: next,
                        },
                      });
                    }}
                  />
                </td>
              ))}
              <td />
            </tr>
          );
        })}
      </>
    );
  }

  if (model.kind === "baseWithVariable") {
    return (
      <>
        <tr className="border-t border-border">
          <td className="p-2 font-semibold whitespace-nowrap">
            Base ({model.variable.includedUnits} {model.variable.label}{" "}
            included)
          </td>
          {model.baseMinor.map((rate, colIndex) => (
            <td key={colIndex} className="p-1">
              <GridMoneyInput
                valueMinor={rate}
                onChange={(minor) => {
                  const baseMinor = [...model.baseMinor];
                  baseMinor[colIndex] = minor;
                  onChange({ ...model, baseMinor });
                }}
              />
            </td>
          ))}
          <td />
        </tr>
        <tr className="border-t border-border">
          <td className="p-2 font-semibold whitespace-nowrap">
            Each extra {model.variable.unitSize.toLocaleString()}{" "}
            {model.variable.label}
          </td>
          {model.extraPerUnitMinor.map((rate, colIndex) => (
            <td key={colIndex} className="p-1">
              <GridMoneyInput
                valueMinor={rate}
                onChange={(minor) => {
                  const extraPerUnitMinor = [...model.extraPerUnitMinor];
                  extraPerUnitMinor[colIndex] = minor;
                  onChange({ ...model, extraPerUnitMinor });
                }}
              />
            </td>
          ))}
          <td />
        </tr>
      </>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="p-2 font-semibold">Rate</td>
      {model.ratesMinor.map((rate, colIndex) => (
        <td key={colIndex} className="p-1">
          <GridMoneyInput
            valueMinor={rate}
            onChange={(minor) => {
              const ratesMinor = [...model.ratesMinor];
              ratesMinor[colIndex] = minor;
              onChange({ ...model, ratesMinor });
            }}
          />
        </td>
      ))}
      <td />
    </tr>
  );
}

function VariableSettings({
  model,
  onChange,
}: {
  model: Extract<RateModel, { kind: "baseWithVariable" }>;
  onChange: (model: RateModel) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-sp-3 border border-border rounded-sm p-sp-3">
      <Field label="What is measured" hint="Shown on the quote form.">
        <input
          className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
          value={model.variable.label}
          onChange={(event) =>
            onChange({
              ...model,
              variable: { ...model.variable, label: event.target.value },
            })
          }
        />
      </Field>
      <NumberField
        label="Unit size"
        hint="e.g. 1000 means rates are quoted per 1,000 stitches."
        value={model.variable.unitSize}
        step={100}
        onChange={(value) =>
          onChange({
            ...model,
            variable: { ...model.variable, unitSize: value || 1 },
          })
        }
      />
      <NumberField
        label="Units included in base"
        value={model.variable.includedUnits}
        step={1}
        onChange={(value) =>
          onChange({
            ...model,
            variable: { ...model.variable, includedUnits: value },
          })
        }
      />
      <div className="flex items-end">
        <ToggleField
          label="Round partial units up"
          hint="Off bills 7,500 stitches as 7.5 units."
          checked={model.variable.roundUpPartialUnits}
          onChange={(checked) =>
            onChange({
              ...model,
              variable: { ...model.variable, roundUpPartialUnits: checked },
            })
          }
        />
      </div>
    </div>
  );
}

function SetupEditor({
  method,
  onChange,
}: {
  method: DecorationMethodConfig;
  onChange: (setup: DecorationMethodConfig["setup"]) => void;
}) {
  const { setup } = method;
  return (
    <div className="space-y-sp-3">
      <h4 className="font-display font-bold m-0">Setup and artwork</h4>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-sp-3">
        <Field label="Fee name" hint="Appears as its own quote line.">
          <input
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
            value={setup.label}
            onChange={(event) =>
              onChange({ ...setup, label: event.target.value })
            }
          />
        </Field>
        <SelectField
          label="Charged per"
          hint="Screens are per colour; digitizing is per design."
          value={setup.per}
          options={[
            { value: "colour", label: "Colour in the design" },
            { value: "design", label: "Design (once)" },
            { value: "location", label: "Location on the garment" },
          ]}
          onChange={(value) => onChange({ ...setup, per: value })}
        />
        <SelectField
          label="When it is charged"
          hint="Screen setup is every job. Digitizing is once per customer."
          value={setup.frequency ?? "perJob"}
          options={[
            { value: "perJob", label: "Every job" },
            { value: "perCustomer", label: "Once per customer" },
            { value: "once", label: "Once ever" },
          ]}
          onChange={(value) => onChange({ ...setup, frequency: value })}
        />
        <MoneyField
          label="New artwork fee"
          valueMinor={setup.newFeeMinor}
          onChange={(minor) => onChange({ ...setup, newFeeMinor: minor })}
        />
        <MoneyField
          label="Repeat artwork fee"
          hint="Charged when we already hold the screens or the digitized file."
          valueMinor={setup.repeatFeeMinor}
          onChange={(minor) => onChange({ ...setup, repeatFeeMinor: minor })}
        />
      </div>
      <div className="grid sm:grid-cols-3 gap-sp-3">
        <ToggleField
          label="Share one fee across garments"
          hint="The same logo on tees and hoodies pays one setup, split by quantity."
          checked={setup.shareAcrossGarments}
          onChange={(checked) =>
            onChange({ ...setup, shareAcrossGarments: checked })
          }
        />
        <ToggleField
          label="Method multiplier applies to this fee"
          hint="Leave off for pass-through costs like digitizing."
          checked={setup.multiplierApplies}
          onChange={(checked) =>
            onChange({ ...setup, multiplierApplies: checked })
          }
        />
        <ToggleField
          label="Staff must verify repeat artwork"
          hint="Until a staff member confirms it, the new-artwork fee is charged."
          checked={setup.repeatRequiresVerification}
          onChange={(checked) =>
            onChange({ ...setup, repeatRequiresVerification: checked })
          }
        />
      </div>
    </div>
  );
}

function ThreadFeeEditor({
  method,
  onChange,
}: {
  method: DecorationMethodConfig;
  onChange: (threadFee: DecorationMethodConfig["threadFee"]) => void;
}) {
  const thread = method.threadFee ?? {
    enabled: false,
    label: "Thread fee",
    description: "",
    kind: "flatPerJob" as const,
    amountMinor: 0,
    multiplierApplies: false,
  };
  return (
    <div className="space-y-sp-3">
      <h4 className="font-display font-bold m-0">Thread fee</h4>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-sp-3">
        <ToggleField
          label="Charge a thread fee"
          hint="Used on embroidery. Leave the amount at $0 to keep the control without charging."
          checked={thread.enabled}
          onChange={(checked) => onChange({ ...thread, enabled: checked })}
        />
        <Field label="Fee name">
          <input
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
            value={thread.label}
            onChange={(event) =>
              onChange({ ...thread, label: event.target.value })
            }
          />
        </Field>
        <SelectField
          label="Charged as"
          value={thread.kind}
          options={[
            { value: "flatPerJob", label: "Once per job" },
            { value: "flatPerPiece", label: "Per piece" },
          ]}
          onChange={(value) => onChange({ ...thread, kind: value })}
        />
        <MoneyField
          label="Amount"
          valueMinor={thread.amountMinor}
          onChange={(minor) => onChange({ ...thread, amountMinor: minor })}
        />
      </div>
    </div>
  );
}

function SurchargeEditor({
  surcharges,
  onChange,
}: {
  surcharges: Surcharge[];
  onChange: (next: Surcharge[]) => void;
}) {
  function update(index: number, next: Surcharge) {
    const copy = [...surcharges];
    copy[index] = next;
    onChange(copy);
  }

  return (
    <div className="space-y-sp-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display font-bold m-0">Surcharges</h4>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange([
              ...surcharges,
              {
                key: `surcharge${surcharges.length + 1}`,
                label: "New surcharge",
                description: "",
                kind: "flatPerPiece",
                value: 50,
                appliesWhen: "locationFlagged",
                enabled: true,
              },
            ])
          }
        >
          Add surcharge
        </Button>
      </div>

      {surcharges.length === 0 && (
        <p className="text-sm text-text-secondary m-0">
          No surcharges on this method.
        </p>
      )}

      {surcharges.map((surcharge, index) => (
        <div
          key={surcharge.key}
          className="border border-border rounded-sm p-sp-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-sp-3 items-end"
        >
          <Field label="Name">
            <input
              className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
              value={surcharge.label}
              onChange={(event) =>
                update(index, { ...surcharge, label: event.target.value })
              }
            />
          </Field>
          <SelectField
            label="Applies when"
            value={surcharge.appliesWhen}
            options={[
              { value: "garmentIsDark", label: "Garment is dark" },
              { value: "locationFlagged", label: "Staff flag the location" },
              { value: "always", label: "Always" },
            ]}
            onChange={(value) =>
              update(index, { ...surcharge, appliesWhen: value })
            }
          />
          <SelectField
            label="Charged as"
            value={surcharge.kind}
            options={[
              { value: "percent", label: "Percent of the run rate" },
              { value: "flatPerPiece", label: "Flat amount per piece" },
            ]}
            onChange={(value) =>
              update(index, {
                ...surcharge,
                kind: value,
                value: value === "percent" ? 0.1 : 50,
              })
            }
          />
          {surcharge.kind === "percent" ? (
            <PercentField
              label="Amount"
              fraction={surcharge.value}
              onChange={(fraction) =>
                update(index, { ...surcharge, value: fraction })
              }
            />
          ) : (
            <Field label="Amount">
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full border border-border rounded-sm pl-7 pr-3 py-2 bg-bg"
                  value={minorToDollars(surcharge.value)}
                  onChange={(event) =>
                    update(index, {
                      ...surcharge,
                      value: dollarsToMinor(event.target.value),
                    })
                  }
                />
              </div>
            </Field>
          )}
          <div className="flex items-center justify-between gap-2">
            <ToggleField
              label="Active"
              checked={surcharge.enabled}
              onChange={(checked) =>
                update(index, { ...surcharge, enabled: checked })
              }
            />
            <button
              type="button"
              className="text-xs text-text-secondary hover:text-accent"
              onClick={() =>
                onChange(surcharges.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
