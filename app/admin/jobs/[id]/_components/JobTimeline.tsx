import type { JobRequestDetailResponse } from "@gwg/contracts";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { formatPortalDateTime } from "@/lib/commerce/portal-progress";

export function JobTimeline({ timeline }: { timeline: JobRequestDetailResponse["timeline"] }) {
  if (timeline.length === 0) {
    return <p className="text-sm text-text-secondary m-0">No history yet.</p>;
  }
  return (
    <ul className="space-y-2 m-0 p-0 list-none">
      {timeline.map((entry) => (
        <li key={entry.id} className="text-sm border-l-2 border-border pl-3">
          <span className="font-semibold">{jobStatusPresentation[entry.toStatus].label}</span>
          {entry.reason ? ` — ${entry.reason}` : ""}
          {entry.actor?.displayName ? ` · ${entry.actor.displayName}` : ""}
          <span className="text-text-tertiary"> · {formatPortalDateTime(entry.occurredAt)}</span>
        </li>
      ))}
    </ul>
  );
}
