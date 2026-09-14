import { cn } from "@/lib/utils/cn";

export function StepPills({
  current,
  pickup,
}: {
  current: number;
  pickup: boolean;
}) {
  // Delivery Method → Turnaround → Address → Review, the order the client
  // asked for in UAT row 50. Turnaround is its own stage rather than a block
  // inside delivery, because mixing the two is the thing row 49 removed.
  const STEPS = [
    { n: 1, label: "Contact" },
    { n: 2, label: "Delivery" },
    { n: 3, label: "Turnaround" },
    { n: 4, label: pickup ? "Pickup" : "Address" },
    { n: 5, label: "Review" },
  ];
  return (
    <div className="flex gap-2 flex-wrap mb-sp-5">
      {STEPS.map((s) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <div
            key={s.n}
            className={cn(
              "flex items-center gap-2 text-[13.5px] font-bold",
              active || done ? "text-text-primary" : "text-text-tertiary"
            )}
          >
            <span
              className={cn(
                "w-[26px] h-[26px] rounded-full grid place-items-center text-xs",
                active || done ? "bg-accent text-white" : "bg-fill-subtle text-text-tertiary"
              )}
            >
              {s.n}
            </span>
            {s.label}
          </div>
        );
      })}
    </div>
  );
}
