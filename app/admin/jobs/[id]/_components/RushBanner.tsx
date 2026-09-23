import type { JobView } from "@/lib/admin/job-view";
import { RushConfirmationForm } from "@/components/admin/RushConfirmationForm";
import { RUSH_FLAG_LABEL, formatRequestedDate } from "@/lib/schemas/checkout";

/** The client's point 3: the requested date "needs to be prominently
 *  displayed" and staff need a way to mark it confirmed. Kept its own
 *  amber banner at the top rather than folded into Fulfilment further
 *  down, since it's the one thing on a job that's time-critical. */
export function RushBanner({ view }: { view: JobView }) {
  if (!view.summary.isRush) return null;
  const { requestedDate, promisedDate, rushConfirmedAt, rushConfirmedByName } = view.summary;
  return (
    <div
      data-admin="rush-request"
      className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 rounded-md px-sp-3 py-sp-3"
    >
      <p className="m-0 font-display font-bold text-amber-900 dark:text-amber-200 tracking-[0.06em]">
        {RUSH_FLAG_LABEL}
      </p>
      <p className="m-0 mt-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
        Customer requested:{" "}
        <b className="tabular-nums">
          {requestedDate ? formatRequestedDate(requestedDate) : "not supplied"}
        </b>
      </p>
      <RushConfirmationForm
        jobId={view.id}
        requestedDate={requestedDate}
        promisedDate={promisedDate}
        confirmedAt={rushConfirmedAt}
        confirmedByName={rushConfirmedByName}
      />
    </div>
  );
}
