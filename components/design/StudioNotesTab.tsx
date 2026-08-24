"use client";

export function StudioNotesTab({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        Special instructions
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, 4_000))}
          rows={8}
          placeholder="Anything the press team should know — ink colour, placement notes, deadlines…"
          className="mt-1.5 w-full resize-y rounded-sm border border-border bg-bg-raised px-2.5 py-2 text-sm font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <p className="m-0 text-[11px] leading-4 text-text-tertiary">
        Saved with the design and passed to the cart as order notes.
      </p>
    </div>
  );
}
