import { describe, expect, it } from "vitest";
import { createStudioHistory, type StudioHistorySnapshot } from "./studio-history";

function snap(label: string): StudioHistorySnapshot {
  return {
    artworksBySide: { front: [{ id: label }], back: [], left: [], right: [] },
    textsBySide: { front: [], back: [], left: [], right: [] },
    placementBySide: { front: label, back: "Upper Back", left: "Left Sleeve", right: "Right Sleeve" },
  };
}

describe("createStudioHistory", () => {
  it("undoes back to the pushed snapshot and redo restores current", () => {
    const history = createStudioHistory();
    const a = snap("a");
    const b = snap("b");
    const c = snap("c");

    history.push(a);
    history.push(b);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    const undone = history.undo(c);
    expect(undone).toEqual(b);
    expect(history.canRedo).toBe(true);

    const undoneAgain = history.undo(b);
    expect(undoneAgain).toEqual(a);

    const redone = history.redo(a);
    expect(redone).toEqual(b);
    const redoneAgain = history.redo(b);
    expect(redoneAgain).toEqual(c);
    expect(history.canRedo).toBe(false);
  });

  it("clears redo when a new edit is pushed after undo", () => {
    const history = createStudioHistory();
    history.push(snap("a"));
    history.undo(snap("b"));
    expect(history.canRedo).toBe(true);
    // New edit from the undone state discards the redo branch.
    history.push(snap("a"));
    expect(history.canRedo).toBe(false);
    expect(history.undo(snap("d"))).toEqual(snap("a"));
  });

  it("returns null when the stack is empty", () => {
    const history = createStudioHistory();
    expect(history.undo(snap("now"))).toBeNull();
    expect(history.redo(snap("now"))).toBeNull();
  });
});
