import type { JobView } from "@/lib/admin/job-view";
import { JobStatusControl } from "@/components/admin/JobStatusControl";

export function OrderStatusCard({ view }: { view: JobView }) {
  return (
    <JobStatusControl
      jobId={view.id}
      statusLabel={view.header.statusLabel}
      tone={view.header.tone}
      pipeline={view.pipeline.stages}
      offTrack={view.pipeline.offTrack}
      nextStatuses={view.nextStatuses}
    />
  );
}
