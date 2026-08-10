import { cn } from "@/lib/utils/cn";

const STEPS = [
  { n: 1, label: "Contact" },
  { n: 2, label: "Ship To" },
  { n: 3, label: "Delivery" },
  { n: 4, label: "Payment" },
];

export function StepPills({ current }: { current: number }) {
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
