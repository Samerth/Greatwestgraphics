import type { JobRequestDetailResponse } from "@gwg/contracts";
import { DataList, DataRow } from "@/components/ui/DataList";

export function CustomerCard({ contact }: { contact: JobRequestDetailResponse["contact"] }) {
  if (!contact) {
    return (
      <p className="text-sm text-text-secondary m-0">
        Contact details are unavailable for this legacy job.
      </p>
    );
  }
  return (
    <DataList columns={2}>
      <DataRow label="Name" emphasis>
        {contact.fullName}
      </DataRow>
      {contact.company && <DataRow label="Company">{contact.company}</DataRow>}
      <DataRow label="Email">
        <a className="text-accent underline" href={`mailto:${contact.email}`}>
          {contact.email}
        </a>
      </DataRow>
      <DataRow label="Phone">
        <a className="text-accent underline" href={`tel:${contact.phone}`}>
          {contact.phone}
        </a>
      </DataRow>
    </DataList>
  );
}
