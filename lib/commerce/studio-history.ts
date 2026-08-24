export type StudioHistorySnapshot = {
  artworksBySide: unknown;
  textsBySide: unknown;
  placementBySide: unknown;
};

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function snapshotsEqual(
  a: StudioHistorySnapshot,
  b: StudioHistorySnapshot,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Linear undo/redo stack for studio layers and transforms.
 * Call `push` with the state *before* a user edit. Upload URL swaps and
 * live-drag zone labels should not push.
 */
export function createStudioHistory(limit = 40) {
  let past: StudioHistorySnapshot[] = [];
  let future: StudioHistorySnapshot[] = [];

  return {
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get pastCount() {
      return past.length;
    },
    get futureCount() {
      return future.length;
    },
    push(current: StudioHistorySnapshot) {
      const next = cloneSnapshot(current);
      const last = past[past.length - 1];
      if (last && snapshotsEqual(last, next)) return;
      past = [...past, next].slice(-limit);
      future = [];
    },
    undo(current: StudioHistorySnapshot): StudioHistorySnapshot | null {
      if (past.length === 0) return null;
      const prev = past[past.length - 1]!;
      past = past.slice(0, -1);
      future = [cloneSnapshot(current), ...future];
      return cloneSnapshot(prev);
    },
    redo(current: StudioHistorySnapshot): StudioHistorySnapshot | null {
      if (future.length === 0) return null;
      const next = future[0]!;
      future = future.slice(1);
      past = [...past, cloneSnapshot(current)];
      return cloneSnapshot(next);
    },
    clear() {
      past = [];
      future = [];
    },
  };
}

export type StudioHistory = ReturnType<typeof createStudioHistory>;
