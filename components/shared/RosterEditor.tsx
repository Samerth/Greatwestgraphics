"use client";

export type RosterRow = { size: string; name: string; number: string };

function wideRosterCountLabel(rows: RosterRow[]): string {
  const started = rows.filter(
    (row) => row.name.trim() || row.number.trim(),
  ).length;
  if (started === 0) {
    return "No team shirts yet — Size and quantity below still apply.";
  }
  return `${started} team shirt${started === 1 ? "" : "s"}`;
}

export function RosterEditor({
  sizes,
  rows,
  onChange,
  layout = "compact",
  showSize = true,
}: {
  sizes: { id: string; label: string }[];
  rows: RosterRow[];
  onChange: (rows: RosterRow[]) => void;
  /** compact = PDP / narrow rails. wide = Design Studio team panel. */
  layout?: "compact" | "wide";
  /**
   * Whether this editor asks for each person's size.
   *
   * False in the Design Studio, where the roster captures only what gets
   * *printed* — the name and number. Which size each person takes is an
   * ordering decision, and it is collected on the Input Quantity step with
   * every other quantity input. The `size` field stays on the row either
   * way so the two halves rejoin without a second data shape.
   */
  showSize?: boolean;
}) {
  function updateRow(index: number, patch: Partial<RosterRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function addRow() {
    onChange([
      ...rows,
      {
        size: layout === "wide" ? "" : (sizes[0]?.label ?? ""),
        name: "",
        number: "",
      },
    ]);
  }
  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    if (layout === "wide" && next.length === 0) {
      onChange([{ size: "", name: "", number: "" }]);
      return;
    }
    onChange(next);
  }

  return (
    <div>
      <div className="space-y-2 mb-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className={
              layout === "wide"
                ? showSize
                  ? "grid grid-cols-[120px_minmax(0,1fr)_100px_36px] gap-2 items-center"
                  : "grid grid-cols-[minmax(0,1fr)_100px_36px] gap-2 items-center"
                : showSize
                  ? "grid grid-cols-[72px_1fr_60px_28px] gap-1.5 items-center"
                  : "grid grid-cols-[1fr_60px_28px] gap-1.5 items-center"
            }
          >
            {showSize && (
              <select
                value={row.size}
                onChange={(e) => updateRow(i, { size: e.target.value })}
                className="border border-border rounded-sm bg-bg-raised px-1.5 py-2 text-[12.5px] font-semibold"
              >
                {layout === "wide" ? <option value="">Size</option> : null}
                {sizes.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            <input
              value={row.name}
              onChange={(e) => updateRow(i, { name: e.target.value })}
              placeholder={layout === "wide" ? "e.g. Alex" : "Name"}
              className="border border-border rounded-sm bg-bg-raised px-2.5 py-2 text-sm min-w-0"
            />
            <input
              value={row.number}
              onChange={(e) => updateRow(i, { number: e.target.value })}
              placeholder={layout === "wide" ? "e.g. 07" : "#"}
              className="border border-border rounded-sm bg-bg-raised px-2 py-2 text-sm min-w-0"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="Remove person"
              className="text-text-tertiary hover:text-red-600 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="text-xs font-bold text-accent hover:underline"
      >
        + Add person
      </button>
      <p className="text-xs text-text-tertiary mt-1.5 mb-0">
        {layout === "wide"
          ? wideRosterCountLabel(rows)
          : `${rows.length} piece${rows.length === 1 ? "" : "s"} total`}
      </p>
    </div>
  );
}
