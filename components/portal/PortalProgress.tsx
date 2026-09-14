import type { JobRequestStatus } from "@gwg/contracts";
import { cn } from "@/lib/utils/cn";
import {
  formatPortalDate,
  portalStageStates,
  portalTimeline,
  type PortalAction,
} from "@/lib/commerce/portal-progress";

/**
 * Order header and stage tracker (CodSphere UAT V2 row 55, points 1 and 8).
 *
 * Server components — none of this is interactive, and the portal is read far
 * more often than it is acted on.
 */
export function PortalOrderHeader({
  displayId,
  placedAt,
  statusLabel,
  status,
}: {
  displayId: string;
  placedAt: string | null;
  statusLabel: string;
  status: JobRequestStatus;
}) {
  const stages = portalStageStates(status);
  const offTrack = stages.every((entry) => entry.state === "upcoming");

  return (
    <header className="border border-border rounded-lg bg-bg-raised p-sp-4 sm:p-sp-5">
      <div className="flex flex-wrap items-start justify-between gap-sp-3">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-display-sm m-0">
            {displayId}
          </h1>
          {placedAt ? (
            <p className="text-sm text-text-secondary mt-1.5 mb-0">
              Order placed: {formatPortalDate(placedAt)}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
            Current status
          </span>
          <span className="mt-1 inline-block rounded-full bg-accent px-3 py-1 text-sm font-bold text-white">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Hidden for a cancelled or rejected job: a tracker with nothing lit
          reads as "stuck at the start", which is the wrong story entirely. */}
      {!offTrack && (
        <ol
          data-portal="stage-tracker"
          className="mt-sp-4 grid gap-2 sm:grid-cols-5 list-none p-0 m-0"
        >
          {stages.map(({ stage, state }) => (
            <li key={stage} className="min-w-0">
              <span
                aria-hidden
                className={cn(
                  "block h-1.5 rounded-full",
                  state === "done" && "bg-accent",
                  state === "current" && "bg-accent",
                  state === "upcoming" && "bg-fill-subtle",
                )}
              />
              <span
                className={cn(
                  "mt-1.5 block text-[12px] leading-snug",
                  state === "current"
                    ? "font-bold text-text-primary"
                    : state === "done"
                      ? "font-semibold text-text-secondary"
                      : "text-text-tertiary",
                )}
              >
                {stage}
                {state === "current" && (
                  <span className="sr-only"> — current stage</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </header>
  );
}

/**
 * The next action, made impossible to miss (point 2). The client's words:
 * "This makes it immediately obvious whether GWG or the customer needs to do
 * something."
 */
export function PortalNextAction({ action }: { action: PortalAction }) {
  return (
    <section
      data-portal="next-action"
      data-required={action.required ? "yes" : "no"}
      className={cn(
        "rounded-lg p-sp-4 border-2",
        action.required
          ? "border-accent bg-accent-tint"
          : "border-border bg-bg-raised",
      )}
    >
      <p
        className={cn(
          "m-0 font-display font-bold",
          action.required ? "text-lg text-accent" : "text-base text-text-primary",
        )}
      >
        {action.required ? `ACTION REQUIRED: ${action.title}` : action.title}
      </p>
      <p className="m-0 mt-1.5 text-sm text-text-secondary">{action.body}</p>
    </section>
  );
}

/** Point 8 — the timeline in the customer's language, not ours. */
export function PortalTimeline({
  status,
  history,
}: {
  status: JobRequestStatus;
  history: readonly { toStatus: JobRequestStatus; occurredAt: string }[];
}) {
  const entries = portalTimeline(status, history);

  return (
    <ol data-portal="timeline" className="list-none p-0 m-0 space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.stage} className="flex items-start gap-2.5 text-sm">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 shrink-0 font-bold",
              entry.state === "done" && "text-accent",
              entry.state === "current" && "text-accent",
              entry.state === "upcoming" && "text-text-tertiary",
            )}
          >
            {entry.state === "done" ? "✓" : entry.state === "current" ? "●" : "○"}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                entry.state === "upcoming"
                  ? "text-text-tertiary"
                  : "font-semibold text-text-primary",
              )}
            >
              {entry.stage}
            </span>
            {entry.occurredAt ? (
              <span className="text-text-tertiary">
                {" "}
                — {formatPortalDate(entry.occurredAt)}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
