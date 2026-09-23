import { LOCATIONS, STITCH_PRESETS, type StitchPresetId } from "@/lib/utils/shop-quote";

/**
 * One decoration as the product page's calculator holds it. Deliberately a
 * structural type rather than `DecorationRow` from `PdpDetailedQuote`, so
 * this stays importable from anywhere (including the starting-price headline,
 * which builds its own default selection and has no calculator row).
 */
export type DecorationSummarySelection = {
  methodKey: string;
  location?: string;
  colours?: number;
  stitchPreset?: StitchPresetId;
};

/** Just the parts of a published method config this needs. */
export type DecorationSummaryMethod = { key: string; label: string };

/**
 * Turn the customer's current decoration selections into one plain sentence,
 * e.g. "Includes a 1-colour screen print on the front."
 *
 * Why this exists: the "Estimated from $X each" headline on the product page
 * never said what decoration that price assumed (Pavin's note, "Quote price
 * include 1 color screen print"). The obvious fix — printing a fixed
 * "includes a 1-colour screen print" line under the price — would be wrong
 * the moment the customer picks embroidery or adds a second location,
 * because that headline is *live*: it tracks the Live Estimate Calculator's
 * own selections via `usePdpLiveEstimate`. So the sentence is derived from
 * the same selections the price is, and changes with them.
 *
 * Returns `null` when there is nothing meaningful to say, so a caller can
 * render nothing rather than an empty or misleading line.
 */
export function decorationSummary(
  selections: readonly DecorationSummarySelection[],
  methods: readonly DecorationSummaryMethod[],
): string | null {
  const phrases = selections
    .map((selection) => phraseFor(selection, methods))
    .filter((phrase): phrase is string => phrase !== null);

  if (phrases.length === 0) return null;
  if (phrases.length === 1) return `Includes ${phrases[0]}.`;
  if (phrases.length === 2) return `Includes ${phrases[0]} and ${phrases[1]}.`;
  // Three or four locations named in full runs longer than the price it sits
  // under; the calculator directly below already lists each row in full.
  return `Includes ${phrases.length} decorations.`;
}

function phraseFor(
  selection: DecorationSummarySelection,
  methods: readonly DecorationSummaryMethod[],
): string | null {
  const label = methods.find((m) => m.key === selection.methodKey)?.label;
  if (!label) return null;

  // Method labels are title-cased in the published config ("Screen Print",
  // "Embroidery") and read wrong mid-sentence, but an acronym ("DTF") must
  // keep its capitals — so only fold the ones that aren't already all-caps.
  const method = label === label.toUpperCase() ? label : label.toLowerCase();

  let what: string;
  if (selection.colours && selection.colours > 0) {
    what = `a ${selection.colours}-colour ${method}`;
  } else if (selection.stitchPreset) {
    const preset = STITCH_PRESETS.find((p) => p.id === selection.stitchPreset);
    what = preset ? `${preset.label.toLowerCase()} ${method}` : `a ${method}`;
  } else {
    // "a DTF print" reads; "a DTF" does not. Methods whose own label already
    // names the process ("Screen Print", "Embroidery") need no such help.
    what = /print|embroider/i.test(method) ? `a ${method}` : `a ${method} print`;
  }

  const location = LOCATIONS.find((l) => l.id === selection.location);
  return location ? `${what} on the ${location.label.toLowerCase()}` : what;
}
