"use client";

import { useMemo, useState } from "react";
import type {
  DecorationMethodConfig,
  PricingConfigV2,
  QuoteBreakdownV2,
  QuoteDecorationLine,
  QuoteGarmentLine,
  QuoteInputV2,
  QuoteLineV2,
} from "@gwg/contracts";
import { calculateQuoteV2 } from "@gwg/pricing";
import { Button } from "@/components/shared/Button";
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
  publishedConfig: PricingConfigV2 | null;
};

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

function starterQuote(config: PricingConfigV2): QuoteInputV2 {
  const method = config.methods.find((entry) => entry.enabled) ?? config.methods[0]!;
  return {
    garments: [
      {
        id: "g1",
        description: "Gildan 5000 tee",
        unitCostMinor: 800,
        quantity: 48,
        colourName: "Black",
        isDark: undefined,
      } as QuoteGarmentLine,
    ],
    decorations: [
      {
        id: "d1",
        garmentId: "g1",
        methodKey: method.key,
        location: "Full front",
        logoGroup: "",
        colours: method.rateModel.kind === "matrixByColour" ? 2 : undefined,
        variableValue:
          method.rateModel.kind === "baseWithVariable" ? 8000 : undefined,
        optionKey:
          method.rateModel.kind === "matrixByOption"
            ? method.rateModel.options[0]?.key
            : undefined,
        isOversized: false,
        artwork: { isRepeat: false, verifiedByStaff: false },
      } as QuoteDecorationLine,
    ],
    options: {
      rush: false,
      includePacking: false,
      namesNumbers: false,
      shippingCostMinor: 0,
      designHours: 0,
    },
  };
}

export function CalculatorTab({ config, publishedConfig }: Props) {
  const [quote, setQuote] = useState<QuoteInputV2>(() => starterQuote(config));
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);

  const result = useMemo(() => {
    try {
      return { breakdown: calculateQuoteV2(quote, config), error: null };
    } catch (error) {
      return {
        breakdown: null,
        error: error instanceof Error ? error.message : "Could not price this quote",
      };
    }
  }, [quote, config]);

  const publishedResult = useMemo(() => {
    if (!compare || !publishedConfig) return null;
    try {
      return calculateQuoteV2(quote, publishedConfig);
    } catch {
      return null;
    }
  }, [compare, publishedConfig, quote]);

  function updateGarment(index: number, patch: Partial<QuoteGarmentLine>) {
    const garments = [...quote.garments];
    garments[index] = { ...garments[index]!, ...patch };
    setQuote({ ...quote, garments });
  }

  function updateDecoration(
    index: number,
    patch: Partial<QuoteDecorationLine>,
  ) {
    const decorations = [...quote.decorations];
    decorations[index] = { ...decorations[index]!, ...patch };
    setQuote({ ...quote, decorations });
  }

  function addGarment() {
    const id = nextId("g");
    setQuote({
      ...quote,
      garments: [
        ...quote.garments,
        {
          id,
          description: "Additional garment",
          unitCostMinor: 800,
          quantity: 24,
          colourName: "Black",
        } as QuoteGarmentLine,
      ],
    });
  }

  function addDecoration() {
    const method =
      config.methods.find((entry) => entry.enabled) ?? config.methods[0]!;
    setQuote({
      ...quote,
      decorations: [
        ...quote.decorations,
        {
          id: nextId("d"),
          garmentId: quote.garments[0]?.id ?? "g1",
          methodKey: method.key,
          location: "Left chest",
          logoGroup: "",
          colours: method.rateModel.kind === "matrixByColour" ? 1 : undefined,
          variableValue:
            method.rateModel.kind === "baseWithVariable" ? 6000 : undefined,
          optionKey:
            method.rateModel.kind === "matrixByOption"
              ? method.rateModel.options[0]?.key
              : undefined,
          isOversized: false,
          artwork: { isRepeat: false, verifiedByStaff: false },
        } as QuoteDecorationLine,
      ],
    });
  }

  return (
    <div className="space-y-sp-4">
      <p className="text-sm text-text-secondary m-0 max-w-[75ch]">
        Build any order here to see what it would be quoted at with the settings
        currently on screen, including unsaved edits. Every line can be expanded
        to show the exact numbers and which setting each one came from.
      </p>

      <div className="grid lg:grid-cols-2 gap-sp-4 items-start">
        <div className="space-y-sp-4">
          <Panel
            title="Garments"
            actions={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addGarment}
              >
                Add
              </Button>
            }
          >
            {quote.garments.map((garment, index) => (
              <div
                key={garment.id}
                className="border border-border rounded-sm p-sp-3 space-y-sp-3"
              >
                <div className="grid sm:grid-cols-2 gap-sp-3">
                  <Field label="Description">
                    <input
                      className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
                      value={garment.description}
                      onChange={(event) =>
                        updateGarment(index, { description: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Colour">
                    <input
                      className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
                      value={garment.colourName}
                      onChange={(event) =>
                        updateGarment(index, { colourName: event.target.value })
                      }
                    />
                  </Field>
                  <MoneyField
                    label="Our cost per piece"
                    valueMinor={garment.unitCostMinor}
                    onChange={(minor) =>
                      updateGarment(index, { unitCostMinor: minor })
                    }
                  />
                  <NumberField
                    label="Quantity"
                    value={garment.quantity}
                    onChange={(value) =>
                      updateGarment(index, {
                        quantity: Math.max(1, Math.round(value)),
                      })
                    }
                  />
                  <MoneyField
                    label="Vendor MAP"
                    hint="Optional. Used when MAP policy is floor or warn."
                    valueMinor={garment.mapPriceMinor ?? 0}
                    onChange={(minor) =>
                      updateGarment(index, {
                        mapPriceMinor: minor > 0 ? minor : undefined,
                      })
                    }
                  />
                </div>
                {quote.garments.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-text-secondary hover:text-accent"
                    onClick={() =>
                      setQuote({
                        ...quote,
                        garments: quote.garments.filter((_, i) => i !== index),
                        decorations: quote.decorations.filter(
                          (decoration) => decoration.garmentId !== garment.id,
                        ),
                      })
                    }
                  >
                    Remove garment
                  </button>
                )}
              </div>
            ))}
          </Panel>

          <Panel
            title="Decoration"
            actions={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addDecoration}
              >
                Add
              </Button>
            }
          >
            {quote.decorations.map((decoration, index) => {
              const method = config.methods.find(
                (entry) => entry.key === decoration.methodKey,
              );
              return (
                <div
                  key={decoration.id}
                  className="border border-border rounded-sm p-sp-3 space-y-sp-3"
                >
                  <div className="grid sm:grid-cols-2 gap-sp-3">
                    <SelectField
                      label="Method"
                      value={decoration.methodKey}
                      options={config.methods.map((entry) => ({
                        value: entry.key,
                        label: entry.enabled
                          ? entry.label
                          : `${entry.label} (disabled)`,
                      }))}
                      onChange={(value) =>
                        updateDecoration(index, {
                          methodKey: value,
                          ...defaultsForMethod(
                            config.methods.find((m) => m.key === value),
                          ),
                        })
                      }
                    />
                    <SelectField
                      label="On garment"
                      value={decoration.garmentId}
                      options={quote.garments.map((garment) => ({
                        value: garment.id,
                        label: garment.description || garment.id,
                      }))}
                      onChange={(value) =>
                        updateDecoration(index, { garmentId: value })
                      }
                    />
                    <Field label="Location">
                      <input
                        className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
                        value={decoration.location}
                        onChange={(event) =>
                          updateDecoration(index, {
                            location: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Logo group"
                      hint="Same name on two lines shares one setup fee."
                    >
                      <input
                        className="mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg"
                        value={decoration.logoGroup}
                        onChange={(event) =>
                          updateDecoration(index, {
                            logoGroup: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <MethodSpecificInput
                      method={method}
                      decoration={decoration}
                      onChange={(patch) => updateDecoration(index, patch)}
                    />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-sp-3">
                    <ToggleField
                      label="Oversized print"
                      checked={decoration.isOversized}
                      onChange={(checked) =>
                        updateDecoration(index, { isOversized: checked })
                      }
                    />
                    <ToggleField
                      label="Customer says repeat"
                      checked={decoration.artwork.isRepeat}
                      onChange={(checked) =>
                        updateDecoration(index, {
                          artwork: {
                            ...decoration.artwork,
                            isRepeat: checked,
                          },
                        })
                      }
                    />
                    <ToggleField
                      label="Staff verified repeat"
                      hint="Repeat pricing only applies once this is ticked."
                      checked={decoration.artwork.verifiedByStaff}
                      onChange={(checked) =>
                        updateDecoration(index, {
                          artwork: {
                            ...decoration.artwork,
                            verifiedByStaff: checked,
                          },
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="text-xs text-text-secondary hover:text-accent"
                    onClick={() =>
                      setQuote({
                        ...quote,
                        decorations: quote.decorations.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    Remove decoration
                  </button>
                </div>
              );
            })}
          </Panel>

          <Panel title="Order options">
            <div className="grid sm:grid-cols-2 gap-sp-3">
              <ToggleField
                label="Rush order"
                checked={quote.options.rush}
                onChange={(checked) =>
                  setQuote({
                    ...quote,
                    options: { ...quote.options, rush: checked },
                  })
                }
              />
              <ToggleField
                label="Individually polybag"
                checked={quote.options.includePacking}
                onChange={(checked) =>
                  setQuote({
                    ...quote,
                    options: { ...quote.options, includePacking: checked },
                  })
                }
              />
              <MoneyField
                label="Freight cost"
                hint="What the carrier charges us."
                valueMinor={quote.options.shippingCostMinor}
                onChange={(minor) =>
                  setQuote({
                    ...quote,
                    options: { ...quote.options, shippingCostMinor: minor },
                  })
                }
              />
              <NumberField
                label="Design hours"
                value={quote.options.designHours}
                step={0.25}
                onChange={(value) =>
                  setQuote({
                    ...quote,
                    options: { ...quote.options, designHours: value },
                  })
                }
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-sp-4 lg:sticky lg:top-4">
          {result.error && (
            <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0 text-sm">
              {result.error}
            </p>
          )}
          {result.breakdown && (
            <QuoteResult
              breakdown={result.breakdown}
              quote={quote}
              config={config}
              openLine={openLine}
              onToggleLine={(id) => setOpenLine(openLine === id ? null : id)}
            />
          )}
          {publishedConfig && (
            <Panel
              title="Compare with live pricing"
              description="See what this same order would cost on the currently published version."
            >
              <ToggleField
                label={`Compare against published v${publishedConfig.version}`}
                checked={compare}
                onChange={setCompare}
              />
              {compare && publishedResult && result.breakdown && (
                <ComparisonTable
                  draft={result.breakdown}
                  published={publishedResult}
                />
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultsForMethod(
  method: DecorationMethodConfig | undefined,
): Partial<QuoteDecorationLine> {
  if (!method) return {};
  return {
    colours: method.rateModel.kind === "matrixByColour" ? 1 : undefined,
    variableValue:
      method.rateModel.kind === "baseWithVariable" ? 6000 : undefined,
    optionKey:
      method.rateModel.kind === "matrixByOption"
        ? method.rateModel.options[0]?.key
        : undefined,
  };
}

function MethodSpecificInput({
  method,
  decoration,
  onChange,
}: {
  method: DecorationMethodConfig | undefined;
  decoration: QuoteDecorationLine;
  onChange: (patch: Partial<QuoteDecorationLine>) => void;
}) {
  if (!method) return null;

  if (method.rateModel.kind === "matrixByColour") {
    return (
      <NumberField
        label="Ink colours"
        value={decoration.colours ?? 1}
        min={method.rateModel.minColours}
        onChange={(value) => onChange({ colours: Math.max(1, Math.round(value)) })}
      />
    );
  }

  if (method.rateModel.kind === "baseWithVariable") {
    return (
      <NumberField
        label={capitalize(method.rateModel.variable.label)}
        value={decoration.variableValue ?? 0}
        step={500}
        onChange={(value) => onChange({ variableValue: value })}
      />
    );
  }

  if (method.rateModel.kind === "matrixByOption") {
    return (
      <SelectField
        label="Size"
        value={decoration.optionKey ?? method.rateModel.options[0]!.key}
        options={method.rateModel.options.map((option) => ({
          value: option.key,
          label: option.label,
        }))}
        onChange={(value) => onChange({ optionKey: value })}
      />
    );
  }

  return null;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function QuoteResult({
  breakdown,
  quote,
  config,
  openLine,
  onToggleLine,
}: {
  breakdown: QuoteBreakdownV2;
  quote: QuoteInputV2;
  config: PricingConfigV2;
  openLine: string | null;
  onToggleLine: (id: string) => void;
}) {
  const { totals } = breakdown;
  const lowMargin =
    totals.grossMarginPercent < config.settings.marginWarningThreshold * 100;

  return (
    <Panel
      title="What the customer pays"
      description={`Priced with version ${breakdown.pricingConfigVersion}. Valid ${breakdown.expiresInDays} days.`}
    >
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm m-0 mb-sp-3">
        {breakdown.garments.map((garment) => (
          <div key={garment.garmentId} className="contents">
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Cost</dt>
              <dd className="m-0">{formatMoney(garment.unitCostMinor)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Markup</dt>
              <dd className="m-0">
                {garment.unitCostMinor > 0
                  ? `${(garment.sellPerPieceMinor / garment.unitCostMinor).toFixed(3)}×`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Garment after markup</dt>
              <dd className="m-0">{formatMoney(garment.sellPerPieceMinor)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Decoration / piece</dt>
              <dd className="m-0">
                {formatMoney(garment.decorationPerPieceMinor)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Quantity</dt>
              <dd className="m-0">{garment.quantity}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">MAP</dt>
              <dd className="m-0">
                {quote.garments.find((row) => row.id === garment.garmentId)
                  ?.mapPriceMinor
                  ? formatMoney(
                      quote.garments.find((row) => row.id === garment.garmentId)!
                        .mapPriceMinor!,
                    )
                  : "—"}
              </dd>
            </div>
          </div>
        ))}
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Setup</dt>
          <dd className="m-0">{formatMoney(totals.setupMinor)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Thread</dt>
          <dd className="m-0">{formatMoney(totals.threadMinor ?? 0)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-secondary m-0">
            Order total
          </p>
          <p className="text-3xl font-display font-bold text-accent m-0">
            {formatMoney(totals.totalMinor)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-secondary m-0">
            Per piece
          </p>
          <p className="text-xl font-display font-bold m-0">
            {formatMoney(
              Math.round(totals.totalMinor / Math.max(1, breakdown.totalQuantity)),
            )}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-secondary m-0">
            Gross margin
          </p>
          <p
            className={`text-xl font-display font-bold m-0 ${
              lowMargin ? "text-red-700" : ""
            }`}
          >
            {totals.grossMarginPercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {breakdown.warnings.length > 0 && (
        <ul className="text-sm border border-amber-300 bg-amber-50 text-amber-900 rounded-sm p-sp-3 space-y-1 list-disc pl-6">
          {breakdown.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {breakdown.needsArtworkVerification && (
        <p className="text-sm border border-border rounded-sm p-sp-3 m-0">
          A line is claimed as repeat artwork but hasn&apos;t been verified, so
          new-artwork setup is being charged. Tick &quot;staff verified&quot;
          once the screens or digitized file are confirmed.
        </p>
      )}

      <div className="divide-y divide-border border border-border rounded-sm">
        {breakdown.lines.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            isOpen={openLine === line.id}
            onToggle={() => onToggleLine(line.id)}
          />
        ))}
      </div>

      <dl className="text-sm space-y-1">
        <TotalRow label="Garments" minor={totals.merchandiseMinor} />
        <TotalRow label="Decoration" minor={totals.decorationMinor} />
        <TotalRow label="Setup and artwork" minor={totals.setupMinor} />
        {(totals.threadMinor ?? 0) > 0 && (
          <TotalRow label="Thread" minor={totals.threadMinor} />
        )}
        {totals.packingMinor > 0 && (
          <TotalRow label="Packing" minor={totals.packingMinor} />
        )}
        {totals.shippingMinor > 0 && (
          <TotalRow label="Shipping" minor={totals.shippingMinor} />
        )}
        {totals.rushMinor > 0 && (
          <TotalRow label="Rush" minor={totals.rushMinor} />
        )}
        <div className="flex justify-between border-t border-border pt-2 font-bold text-base">
          <dt>Total</dt>
          <dd className="m-0">{formatMoney(totals.totalMinor)}</dd>
        </div>
        <div className="flex justify-between text-text-secondary">
          <dt>Estimated cost to us</dt>
          <dd className="m-0">{formatMoney(totals.estimatedCostMinor)}</dd>
        </div>
        <div className="flex justify-between text-text-secondary">
          <dt>Gross profit</dt>
          <dd className="m-0">{formatMoney(totals.grossProfitMinor)}</dd>
        </div>
      </dl>
    </Panel>
  );
}

function TotalRow({ label, minor }: { label: string; minor: number }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="m-0">{formatMoney(minor)}</dd>
    </div>
  );
}

function LineRow({
  line,
  isOpen,
  onToggle,
}: {
  line: QuoteLineV2;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 p-sp-3 text-left hover:bg-fill-subtle-15"
      >
        <span className="text-sm">
          <span className="font-semibold block">
            {line.label}
            {line.isOverride && (
              <span className="ml-2 text-xs uppercase tracking-wide text-amber-700">
                override
              </span>
            )}
          </span>
          <span className="text-text-secondary">
            {line.quantity > 1 &&
              `${line.quantity} x ${formatMoney(Math.round(line.unitAmountMinor))} · `}
            {isOpen ? "Hide the math" : "Show the math"}
          </span>
        </span>
        <span className="font-semibold whitespace-nowrap">
          {formatMoney(line.extendedAmountMinor)}
        </span>
      </button>

      {isOpen && (
        <div className="px-sp-3 pb-sp-3 space-y-sp-3 text-sm">
          <p className="m-0">{line.explain.plainEnglish}</p>
          {line.explain.steps.length > 0 && (
            <ol className="space-y-1 pl-5 list-decimal m-0">
              {line.explain.steps.map((step, index) => (
                <li key={index}>
                  <span className="font-semibold">{step.label}: </span>
                  {step.detail}
                  {step.result && (
                    <span className="font-semibold"> = {step.result}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {line.explain.sources.length > 0 && (
            <div className="border border-border rounded-sm p-sp-3 bg-bg">
              <p className="text-xs uppercase tracking-wide text-text-secondary m-0 mb-1">
                Settings used
              </p>
              <ul className="space-y-1 m-0 list-none p-0">
                {line.explain.sources.map((source) => (
                  <li
                    key={source.path}
                    className="flex justify-between gap-3 text-xs"
                  >
                    <span>{source.label}</span>
                    <span className="font-mono">{source.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonTable({
  draft,
  published,
}: {
  draft: QuoteBreakdownV2;
  published: QuoteBreakdownV2;
}) {
  const rows: Array<[string, number, number]> = [
    ["Garments", draft.totals.merchandiseMinor, published.totals.merchandiseMinor],
    ["Decoration", draft.totals.decorationMinor, published.totals.decorationMinor],
    ["Setup", draft.totals.setupMinor, published.totals.setupMinor],
    ["Thread", draft.totals.threadMinor ?? 0, published.totals.threadMinor ?? 0],
    ["Rush", draft.totals.rushMinor, published.totals.rushMinor],
    ["Total", draft.totals.totalMinor, published.totals.totalMinor],
  ];

  return (
    <table className="w-full text-sm mt-sp-3">
      <thead>
        <tr className="text-left text-text-secondary">
          <th className="py-1">Line</th>
          <th className="py-1 text-right">Editing</th>
          <th className="py-1 text-right">Live</th>
          <th className="py-1 text-right">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, draftMinor, publishedMinor]) => {
          const delta = draftMinor - publishedMinor;
          return (
            <tr key={label} className="border-t border-border">
              <td className="py-1">{label}</td>
              <td className="py-1 text-right">{formatMoney(draftMinor)}</td>
              <td className="py-1 text-right text-text-secondary">
                {formatMoney(publishedMinor)}
              </td>
              <td
                className={`py-1 text-right font-semibold ${
                  delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : ""
                }`}
              >
                {delta === 0
                  ? "—"
                  : `${delta > 0 ? "+" : ""}${formatMoney(delta)}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
