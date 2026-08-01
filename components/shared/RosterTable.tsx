export type RosterEntry = { size: string; name: string; number?: string };

/** Read-only per-piece breakdown for a team/group order line — shown to
 * the customer (cart, checkout, portal) and staff (admin job detail) so
 * everyone sees the exact size/name/number production needs to print. */
export function RosterTable({ roster }: { roster: RosterEntry[] }) {
  if (roster.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-text-tertiary border-b border-border">
            <th className="py-1.5 pr-3 font-bold w-8">#</th>
            <th className="py-1.5 pr-3 font-bold">Size</th>
            <th className="py-1.5 pr-3 font-bold">Name</th>
            <th className="py-1.5 font-bold">Number</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((row, i) => (
            <tr key={i} className="border-b border-fill-subtle last:border-0">
              <td className="py-1.5 pr-3 text-text-tertiary">{i + 1}</td>
              <td className="py-1.5 pr-3 font-bold">{row.size || "—"}</td>
              <td className="py-1.5 pr-3">{row.name || "—"}</td>
              <td className="py-1.5">{row.number || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
