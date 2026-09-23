import type { JobView } from "@/lib/admin/job-view";
import { JobInternalNoteForm } from "@/components/admin/JobInternalNoteForm";
import { Card } from "@/components/ui/Card";

/** The client's point 9: keep the customer's own note, and add a genuinely
 *  separate internal one — visually distinct enough that nobody mistakes
 *  which is which. */
export function NotesSection({ view }: { view: JobView }) {
  const { notes } = view;
  return (
    <div className="space-y-3">
      {notes.customer && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0 mb-1">
            From the customer
          </p>
          <p className="text-sm whitespace-pre-wrap m-0">{notes.customer}</p>
        </div>
      )}
      {notes.design.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0 mb-1">
            Design notes
          </p>
          {notes.design.map((note, i) => (
            <p key={i} className="text-sm whitespace-pre-wrap m-0 mt-1">
              {note}
            </p>
          ))}
        </div>
      )}
      <Card tone="accent" padded className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Internal — staff only
        </p>
        <JobInternalNoteForm
          jobId={view.id}
          note={notes.internal}
          updatedAt={notes.internalUpdatedAt}
          updatedByName={notes.internalUpdatedByName}
        />
      </Card>
    </div>
  );
}
