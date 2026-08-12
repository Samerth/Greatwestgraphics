"use client";

import type { ReactNode } from "react";

export function minorToDollars(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function dollarsToMinor(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function formatMoney(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const amount = (Math.abs(minor) / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${amount}`;
}

const inputClass =
  "mt-1 w-full border border-border rounded-sm px-3 py-2 bg-bg text-text-primary";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && (
        <span className="block text-xs text-text-secondary mt-1">{hint}</span>
      )}
    </label>
  );
}

export function MoneyField({
  label,
  hint,
  valueMinor,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  valueMinor: number;
  onChange: (minor: number) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative mt-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
          $
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          disabled={disabled}
          className={`${inputClass} mt-0 pl-7`}
          value={minorToDollars(valueMinor)}
          onChange={(event) => onChange(dollarsToMinor(event.target.value))}
        />
      </div>
    </Field>
  );
}

/** Stores a decimal fraction (0.25) but shows whole percent (25). */
export function PercentField({
  label,
  hint,
  fraction,
  onChange,
  max = 500,
}: {
  label: string;
  hint?: string;
  fraction: number;
  onChange: (fraction: number) => void;
  max?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative mt-1">
        <input
          type="number"
          step="0.5"
          min="0"
          max={max}
          className={`${inputClass} mt-0 pr-8`}
          value={Number((fraction * 100).toFixed(4))}
          onChange={(event) => {
            const parsed = Number.parseFloat(event.target.value);
            onChange(Number.isFinite(parsed) ? parsed / 100 : 0);
          }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
          %
        </span>
      </div>
    </Field>
  );
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        step={step}
        min={min}
        className={inputClass}
        value={value}
        onChange={(event) => {
          const parsed = Number.parseFloat(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm cursor-pointer">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-accent"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="font-semibold block">{label}</span>
        {hint && (
          <span className="block text-xs text-text-secondary">{hint}</span>
        )}
      </span>
    </label>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-border rounded-md bg-bg-raised p-sp-4 space-y-sp-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg m-0">{title}</h3>
          {description && (
            <p className="text-sm text-text-secondary mt-1 mb-0 max-w-[70ch]">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Small cell input used inside rate grids, in dollars. */
export function GridMoneyInput({
  valueMinor,
  onChange,
  title,
}: {
  valueMinor: number;
  onChange: (minor: number) => void;
  title?: string;
}) {
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      title={title}
      className="w-20 border border-border rounded-sm px-2 py-1 text-sm bg-bg"
      value={minorToDollars(valueMinor)}
      onChange={(event) => onChange(dollarsToMinor(event.target.value))}
    />
  );
}

export function GridNumberInput({
  value,
  onChange,
  title,
  step = 0.01,
}: {
  value: number;
  onChange: (value: number) => void;
  title?: string;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      min="0"
      title={title}
      className="w-16 border border-border rounded-sm px-2 py-1 text-sm bg-bg"
      value={value}
      onChange={(event) => {
        const parsed = Number.parseFloat(event.target.value);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
    />
  );
}
