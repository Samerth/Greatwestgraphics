"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { runSyncAction, type RunSyncState } from "@/app/admin/actions";
import {
  SYNC_ACCEPT_WAIT_MS,
  SYNC_POLL_INTERVAL_MS,
  findActiveVendorRun,
  formatSyncStartedAt,
  isRunForCurrentStart,
  liveSyncCopy,
  mergePendingSyncRun,
  shouldPollSyncRuns,
  startErrorToShow,
  syncButtonLabel,
  syncStatusTone,
  syncTypeLabel,
  vendorButtonsLocked,
  type SyncStartIntent,
} from "@/lib/admin/catalog-sync-feedback";

export type CatalogSyncVendor = {
  key: string;
  displayName: string;
  capabilities: {
    fullSync: boolean;
    inventorySync: boolean;
    csvImport: boolean;
  };
  configured: boolean;
  notes?: string;
  fullLabel: string;
  stockLabel: string;
  fullWhen: string;
  stockWhen: string;
};

const initialState: RunSyncState = {};

function SyncSpinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
    />
  );
}

function SyncVendorButton({
  idleLabel,
  vendorKey,
  type,
  intent,
  activeRun,
  disabled,
  className,
}: {
  idleLabel: string;
  vendorKey: string;
  type: "full" | "inventory";
  intent: SyncStartIntent | null;
  activeRun?: Record<string, unknown>;
  disabled: boolean;
  className: string;
}) {
  const { pending } = useFormStatus();
  const label = syncButtonLabel({
    idleLabel,
    vendorKey,
    type,
    intent,
    formPending: pending,
    activeRun,
  });
  const busy = label !== idleLabel;
  return (
    <button type="submit" disabled={disabled} className={className}>
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <SyncSpinner />
          {label}
        </span>
      ) : (
        label
      )}
    </button>
  );
}

export function CatalogSyncPanel({
  vendors,
  initialRuns,
  children,
}: {
  vendors: CatalogSyncVendor[];
  initialRuns: Record<string, unknown>[];
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    runSyncAction,
    initialState,
  );
  const [runs, setRuns] = useState(initialRuns);
  const [intent, setIntent] = useState<SyncStartIntent | null>(null);
  const [pollError, setPollError] = useState<string | undefined>();
  const [acceptWait, setAcceptWait] = useState(false);

  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  const polling = shouldPollSyncRuns(intent, runs);

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const response = await fetch("/api/admin/sync-runs", {
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => undefined);
        const body = payload && typeof payload === "object" ? payload : {};
        if (!response.ok) {
          const err = (body as { error?: { message?: string } }).error?.message;
          if (!cancelled) {
            setPollError(err || "Could not refresh Recent runs.");
          }
          return;
        }
        const next = (body as { runs?: unknown }).runs;
        if (!cancelled && Array.isArray(next)) {
          setPollError(undefined);
          setRuns(next as Record<string, unknown>[]);
        }
      } catch {
        if (!cancelled) setPollError("Could not refresh Recent runs.");
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, SYNC_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [polling]);

  useEffect(() => {
    if (!intent) return;
    if (runs.some((run) => isRunForCurrentStart(run, intent))) {
      setIntent(null);
      setAcceptWait(false);
    }
  }, [intent, runs]);

  useEffect(() => {
    if (pending || !intent || !state.error || state.accepted) return;
    if (state.vendor !== intent.vendor || state.type !== intent.type) return;
    if (runs.some((run) => isRunForCurrentStart(run, intent))) return;
    setIntent(null);
    setAcceptWait(false);
  }, [pending, intent, state, runs]);

  useEffect(() => {
    if (!intent || !state.accepted) {
      setAcceptWait(false);
      return;
    }
    const timer = window.setTimeout(() => setAcceptWait(true), SYNC_ACCEPT_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [intent, state.accepted]);

  const visibleRuns = useMemo(
    () => mergePendingSyncRun(runs, intent),
    [runs, intent],
  );
  const startError = startErrorToShow(state.error, intent, runs, state);

  return (
    <>
      <section className="space-y-3">
        <h2 className="font-display font-bold text-xl m-0">Vendors</h2>
        {startError && (
          <p
            role="alert"
            className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 m-0"
          >
            {startError}
          </p>
        )}
        {pollError && (
          <p
            role="status"
            className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 m-0"
          >
            {pollError}
          </p>
        )}
        {acceptWait && (
          <p
            role="status"
            className="text-sm text-text-secondary border border-border rounded-md px-3 py-2 m-0"
          >
            The server accepted the sync, but it has not appeared in Recent runs
            yet. Keep this page open — the job may still be starting.
          </p>
        )}
        {vendors.map((vendor) => {
          const locked = vendorButtonsLocked(vendor.key, intent, runs);
          const activeRun = findActiveVendorRun(visibleRuns, vendor.key);
          const canClick = vendor.configured || vendor.key === "csv";
          const phase =
            activeRun && String(activeRun.status) === "running"
              ? ("running" as const)
              : intent?.vendor === vendor.key
                ? ("starting" as const)
                : null;
          const live =
            phase === "running" && activeRun
              ? liveSyncCopy({
                  phase: "running",
                  vendorName: vendor.displayName,
                  type: String(activeRun.type ?? ""),
                  startedAt: activeRun.startedAt,
                })
              : phase === "starting" && intent
                ? liveSyncCopy({
                    phase: "starting",
                    vendorName: vendor.displayName,
                    type: intent.type,
                  })
                : null;

          return (
            <article
              key={vendor.key}
              className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-3"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold m-0">{vendor.displayName}</p>
                  <p className="text-sm text-text-secondary m-0 mt-1">
                    {vendor.configured ? "Ready to sync" : "Not configured"}
                    {vendor.notes ? ` · ${vendor.notes}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {vendor.capabilities.fullSync && (
                    <form
                      action={formAction}
                      onSubmit={() => {
                        setAcceptWait(false);
                        setIntent({
                          vendor: vendor.key,
                          type: "full",
                          at: Date.now(),
                        });
                      }}
                    >
                      <input type="hidden" name="vendor" value={vendor.key} />
                      <input type="hidden" name="type" value="full" />
                      <SyncVendorButton
                        idleLabel={vendor.fullLabel}
                        vendorKey={vendor.key}
                        type="full"
                        intent={intent}
                        activeRun={activeRun}
                        disabled={!canClick || locked}
                        className="bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-50"
                      />
                    </form>
                  )}
                  {vendor.capabilities.inventorySync && (
                    <form
                      action={formAction}
                      onSubmit={() => {
                        setAcceptWait(false);
                        setIntent({
                          vendor: vendor.key,
                          type: "inventory",
                          at: Date.now(),
                        });
                      }}
                    >
                      <input type="hidden" name="vendor" value={vendor.key} />
                      <input type="hidden" name="type" value="inventory" />
                      <SyncVendorButton
                        idleLabel={vendor.stockLabel}
                        vendorKey={vendor.key}
                        type="inventory"
                        intent={intent}
                        activeRun={activeRun}
                        disabled={!canClick || locked}
                        className="border border-border font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-50"
                      />
                    </form>
                  )}
                </div>
              </div>

              {live && (
                <p
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 text-sm text-accent m-0 border border-accent bg-fill-subtle-15 rounded-sm px-3 py-2"
                >
                  <SyncSpinner />
                  <span>{live}</span>
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2 text-sm text-text-secondary">
                {vendor.capabilities.fullSync && (
                  <p className="m-0">
                    <span className="font-semibold text-text-primary">
                      {vendor.fullLabel}:
                    </span>{" "}
                    {vendor.fullWhen}
                  </p>
                )}
                {vendor.capabilities.inventorySync && (
                  <p className="m-0">
                    <span className="font-semibold text-text-primary">
                      {vendor.stockLabel}:
                    </span>{" "}
                    {vendor.stockWhen}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {children}

      <section className="space-y-2">
        <h2 className="font-display font-bold text-xl m-0">Recent runs</h2>
        <p className="text-sm text-text-secondary m-0">
          This list refreshes while a job is starting or running. Wait for{" "}
          <b>completed</b> (or read errors if <b>completed_with_errors</b> or{" "}
          <b>failed</b>). Then verify results in{" "}
          <Link href="/admin/catalog" className="text-accent font-bold">
            Catalog
          </Link>
          .
        </p>
        {visibleRuns.length === 0 && (
          <p className="text-sm text-text-secondary m-0">No runs logged yet.</p>
        )}
        {visibleRuns.map((run) => {
          const status = String(run.status ?? "");
          const live = status === "running" || status === "starting";
          return (
            <article
              key={String(run.id)}
              className={`rounded-md p-sp-3 text-sm bg-bg-raised border ${
                live ? "border-accent" : "border-border"
              }`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold m-0">
                  {run.vendor ? `${String(run.vendor)} · ` : ""}
                  {syncTypeLabel(String(run.type ?? ""))} ·{" "}
                  <span className={syncStatusTone(status)}>{status}</span>
                </p>
                <p className="text-text-tertiary m-0">
                  {formatSyncStartedAt(run.startedAt)}
                </p>
              </div>
              <p className="mt-2 mb-0 text-text-secondary">
                styles {String(run.stylesProcessed ?? "—")} · skus{" "}
                {String(run.skusUpserted ?? "—")} · images{" "}
                {String(run.imagesDownloaded ?? "—")}
                {run.rateLimitRemaining != null
                  ? ` · rate-limit ${String(run.rateLimitRemaining)}`
                  : ""}
              </p>
              {run.errorSummary ? (
                <pre className="mt-2 mb-0 text-xs whitespace-pre-wrap text-red-800">
                  {typeof run.errorSummary === "string"
                    ? run.errorSummary
                    : JSON.stringify(run.errorSummary, null, 2)}
                </pre>
              ) : null}
            </article>
          );
        })}
      </section>
    </>
  );
}
