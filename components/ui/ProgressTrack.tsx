import { cn } from "@/lib/utils/cn";
import type { StatusTone } from "@/lib/commerce/status";
import { Badge } from "@/components/ui/Badge";

export interface TrackStage {
  label: string;
  state: "done" | "current" | "upcoming";
  /** A short aside under the stage — "changes requested", "paid" — for a
   *  stage that covers several real statuses (see `lib/admin/job-pipeline.ts`). */
  detail?: string | null;
}

interface ProgressTrackProps {
  stages: readonly TrackStage[];
  /** A job that has left the pipeline entirely — cancelled, rejected.
   *  Shown as a badge instead of the track, because a tracker with nothing
   *  lit reads as "stuck at the start," which is the wrong story. Lifted
   *  from `components/portal/PortalProgress.tsx`'s existing `offTrack`
   *  handling rather than reinvented. */
  offTrack?: { label: string; tone: StatusTone } | null;
}

/** A generalised version of the bar tracker in `PortalProgress.tsx`, for
 *  the client's 7-stage mental model of an order (point 2). Deliberately
 *  not used to rewrite `PortalProgress` itself in this change — that
 *  component's own stage list and tests are pinned separately. */
export function ProgressTrack({ stages, offTrack }: ProgressTrackProps) {
  if (offTrack) {
    return <Badge tone={offTrack.tone}>{offTrack.label}</Badge>;
  }

  return (
    <ol className="grid gap-2 sm:grid-cols-7 list-none p-0 m-0">
      {stages.map((stage) => (
        <li key={stage.label} className="min-w-0">
          <span
            aria-hidden
            className={cn(
              "block h-1.5 rounded-full",
              stage.state === "upcoming" ? "bg-fill-subtle" : "bg-accent",
            )}
          />
          <span
            className={cn(
              "mt-1.5 block text-xs leading-snug",
              stage.state === "current"
                ? "font-bold text-text-primary"
                : stage.state === "done"
                  ? "font-semibold text-text-secondary"
                  : "text-text-tertiary",
            )}
          >
            {stage.label}
            {stage.state === "current" && <span className="sr-only"> — current stage</span>}
          </span>
          {stage.detail && (
            <span className="mt-0.5 block text-[11px] text-text-tertiary">
              {stage.detail}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
