/**
 * Keeps a logo or a piece of text on the studio canvas.
 *
 * Everything past the canvas edge is cut off when the proof image is drawn, yet
 * it still goes into the order, so a logo dragged half off the shirt looked
 * fine to the shopper on screen and arrived at the print shop cropped. The
 * guard it replaced only looked at the artwork's top-left corner and ignored
 * how big the artwork was, so a small logo could still be dropped completely
 * off the left or top edge, and text had no guard at all.
 *
 * Everything here is in the stage's own pixel space (what Konva calls
 * "absolute"), where the canvas spans `min` to `max` on both axes. That span is
 * not simply 0 to the stage size once the shopper has zoomed: at 150% the
 * canvas is larger than the stage and centred on it.
 */

export type CanvasBounds = { min: number; max: number };

export type PixelBox = { x: number; y: number; width: number; height: number };

/** The few things we read from a Konva node, so this stays testable. */
export type MeasurableNode = {
  getAbsolutePosition(): { x: number; y: number };
  getClientRect(): PixelBox;
};

/**
 * The position along one axis that keeps the artwork inside the canvas.
 *
 * `origin` is where the node's own origin wants to be, `offset` is how far the
 * artwork's visible edge sits from that origin (it is not zero for rotated
 * artwork), and `size` is the artwork's visible length on this axis. Artwork
 * longer than the canvas cannot fit inside it, so it is held to cover the
 * canvas instead of being pushed to one side.
 */
export function clampAxis(
  origin: number,
  offset: number,
  size: number,
  bounds: CanvasBounds,
): number {
  const a = bounds.min - offset;
  const b = bounds.max - size - offset;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Math.min(Math.max(origin, lo), hi);
}

/** Where a drag may put the node: the proposed position, held on the canvas. */
export function keepDraggedNodeOnCanvas(
  node: MeasurableNode,
  proposed: { x: number; y: number },
  bounds: CanvasBounds,
): { x: number; y: number } {
  const current = node.getAbsolutePosition();
  const box = node.getClientRect();
  return {
    x: clampAxis(proposed.x, box.x - current.x, box.width, bounds),
    y: clampAxis(proposed.y, box.y - current.y, box.height, bounds),
  };
}

/** How many pixels of the box lie outside the canvas, summed over the sides. */
export function overflowPx(box: PixelBox, bounds: CanvasBounds): number {
  return (
    Math.max(0, bounds.min - box.x) +
    Math.max(0, bounds.min - box.y) +
    Math.max(0, box.x + box.width - bounds.max) +
    Math.max(0, box.y + box.height - bounds.max)
  );
}

/**
 * For a resize: refuse a box that sticks out further than the one it replaces.
 * Comparing with the old box, rather than demanding the new one be inside,
 * means artwork already overhanging the edge can still be shrunk back in
 * instead of being frozen.
 */
export function resizeWouldPushOffCanvas(
  oldBox: PixelBox,
  newBox: PixelBox,
  bounds: CanvasBounds,
): boolean {
  return overflowPx(newBox, bounds) > overflowPx(oldBox, bounds) + 0.5;
}
