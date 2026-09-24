/**
 * Maps a real quantity onto slider *position* and back, so the handle and
 * the printed tick numbers underneath it always agree.
 *
 * The bug this replaces: the `<input type="range">` ran linearly from 1 to
 * 500, but its tick labels (1 · 6 · 12 · 24 · 48 · 72 · 500+) were laid out
 * with `flex justify-between`, i.e. evenly spaced regardless of value. Those
 * are two different scales on the same track. At 71 pieces the handle sat at
 * 14% of the track while the "6" label sat at 17% — right under it — even
 * though 71 has nothing to do with 6. Every label but the first and last was
 * wrong; "48" was drawn at 67% of the track when its true linear position
 * is 9%.
 *
 * The fix: treat `anchors` (the same values the tick row prints, in order)
 * as the only points that matter, and interpolate the handle piecewise
 * between them. Anchor `i` then sits at exactly `i / (anchors.length - 1)`
 * of the track — the same fraction `flex justify-between` already renders
 * its label at — so the handle and the labels are finally the same scale.
 * Quantities between two anchors interpolate smoothly between those two
 * positions; quantities at or beyond the last anchor pin to the far right,
 * under whatever open-ended label ("500+") that anchor represents.
 */

/** Sub-steps of slider *position* within one anchor-to-anchor segment —
 *  resolution only, has no unit of its own. */
const TRACK_SUBSTEPS = 1000;

/** `anchors` must be sorted ascending. A single anchor (or none, treated as
 *  `[1]`) collapses the whole track to one fixed point. */
export function sliderMaxPosition(anchors: readonly number[]): number {
  const segments = Math.max(1, anchors.length - 1);
  return segments * TRACK_SUBSTEPS;
}

export function sliderPositionFromQty(
  qty: number,
  anchors: readonly number[],
): number {
  const list = anchors.length > 0 ? anchors : [1];
  if (list.length === 1) return 0;

  const first = list[0]!;
  const last = list[list.length - 1]!;
  if (qty <= first) return 0;
  if (qty >= last) return sliderMaxPosition(list);

  for (let i = 0; i < list.length - 1; i += 1) {
    const lo = list[i]!;
    const hi = list[i + 1]!;
    if (qty >= lo && qty <= hi) {
      const fraction = hi === lo ? 0 : (qty - lo) / (hi - lo);
      return Math.round((i + fraction) * TRACK_SUBSTEPS);
    }
  }
  // Unreachable given the bounds checks above; keeps the return type exact.
  return sliderMaxPosition(list);
}

export function qtyFromSliderPosition(
  position: number,
  anchors: readonly number[],
): number {
  const list = anchors.length > 0 ? anchors : [1];
  if (list.length === 1) return list[0]!;

  const maxPos = sliderMaxPosition(list);
  const clamped = Math.max(0, Math.min(position, maxPos));
  const segment = Math.min(
    list.length - 2,
    Math.floor(clamped / TRACK_SUBSTEPS),
  );
  const lo = list[segment]!;
  const hi = list[segment + 1]!;
  const withinSegment = clamped - segment * TRACK_SUBSTEPS;
  const fraction = withinSegment / TRACK_SUBSTEPS;
  return Math.round(lo + fraction * (hi - lo));
}
