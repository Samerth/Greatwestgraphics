/** Honest status copy and lock/poll rules for Admin → Catalog sync. */

export const SYNC_POLL_INTERVAL_MS = 2000;
export const SYNC_ACCEPT_WAIT_MS = 20_000;

export type SyncStartIntent = {
  vendor: string;
  type: string;
  at: number;
};

export function syncTypeLabel(type: string): string {
  if (type === "inventory") return "stock & price";
  if (type === "csv_import") return "CSV import";
  if (type === "full") return "full";
  return type || "sync";
}

export function isSyncRunning(status: string): boolean {
  return status === "running";
}

export function isTerminalSyncStatus(status: string): boolean {
  return (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "failed"
  );
}

export function formatSyncStartedAt(value: unknown): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-CA");
}

export function vendorDisplayName(
  vendors: Array<{ key: string; displayName: string }>,
  vendorKey: string,
): string {
  return vendors.find((row) => row.key === vendorKey)?.displayName ?? vendorKey;
}

export function liveSyncCopy(opts: {
  phase: "starting" | "running";
  vendorName: string;
  type: string;
  startedAt?: unknown;
}): string {
  const typeLabel = syncTypeLabel(opts.type);
  if (opts.phase === "starting") {
    return `Starting… ${opts.vendorName} · ${typeLabel}`;
  }
  const started = formatSyncStartedAt(opts.startedAt);
  return started
    ? `Running… ${opts.vendorName} · ${typeLabel} · started ${started}`
    : `Running… ${opts.vendorName} · ${typeLabel}`;
}

export function isRunForCurrentStart(
  run: Record<string, unknown>,
  intent: SyncStartIntent,
): boolean {
  if (String(run.vendor ?? "") !== intent.vendor) return false;
  if (String(run.type ?? "") !== intent.type) return false;
  const status = String(run.status ?? "");
  if (status === "running") return true;
  const started = new Date(String(run.startedAt ?? "")).getTime();
  if (!Number.isFinite(started)) return false;
  return started >= intent.at - 2000;
}

export function mergePendingSyncRun(
  runs: Record<string, unknown>[],
  intent: SyncStartIntent | null,
): Record<string, unknown>[] {
  if (!intent) return runs;
  if (runs.some((run) => isRunForCurrentStart(run, intent))) return runs;
  return [
    {
      id: `pending-${intent.vendor}-${intent.type}`,
      vendor: intent.vendor,
      type: intent.type,
      status: "starting",
      startedAt: new Date(intent.at).toISOString(),
    },
    ...runs,
  ];
}

export function findActiveVendorRun(
  runs: Record<string, unknown>[],
  vendorKey?: string,
): Record<string, unknown> | undefined {
  return runs.find((run) => {
    if (String(run.status ?? "") !== "running") return false;
    if (vendorKey && String(run.vendor ?? "") !== vendorKey) return false;
    return true;
  });
}

export function shouldPollSyncRuns(
  intent: SyncStartIntent | null,
  runs: Record<string, unknown>[],
): boolean {
  if (intent) return true;
  return runs.some((run) => String(run.status ?? "") === "running");
}

export function vendorButtonsLocked(
  vendorKey: string,
  intent: SyncStartIntent | null,
  runs: Record<string, unknown>[],
): boolean {
  if (intent?.vendor === vendorKey) return true;
  return runs.some(
    (run) =>
      String(run.vendor ?? "") === vendorKey &&
      String(run.status ?? "") === "running",
  );
}

export function startErrorToShow(
  error: string | undefined,
  intent: SyncStartIntent | null,
  runs: Record<string, unknown>[],
  started?: { vendor?: string; type?: string },
): string | undefined {
  if (!error || intent) return undefined;
  if (
    started?.vendor &&
    started.type &&
    runs.some(
      (run) =>
        String(run.vendor ?? "") === started.vendor &&
        String(run.type ?? "") === started.type &&
        String(run.status ?? "") === "running",
    )
  ) {
    return undefined;
  }
  return error;
}

export function syncStatusTone(status: string): string {
  switch (status) {
    case "starting":
    case "running":
      return "text-accent";
    case "completed":
      return "text-green-800";
    case "completed_with_errors":
      return "text-amber-800";
    case "failed":
      return "text-red-800";
    default:
      return "text-text-primary";
  }
}

export function syncButtonLabel(opts: {
  idleLabel: string;
  vendorKey: string;
  type: string;
  intent: SyncStartIntent | null;
  formPending: boolean;
  activeRun?: Record<string, unknown>;
}): string {
  const run = opts.activeRun;
  const thisRunning =
    run &&
    String(run.vendor ?? "") === opts.vendorKey &&
    String(run.type ?? "") === opts.type &&
    String(run.status ?? "") === "running";
  if (thisRunning) return "Running…";
  const thisStarting =
    opts.formPending ||
    (opts.intent?.vendor === opts.vendorKey && opts.intent.type === opts.type);
  if (thisStarting) return "Starting…";
  return opts.idleLabel;
}
