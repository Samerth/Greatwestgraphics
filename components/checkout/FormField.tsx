import { cn } from "@/lib/utils/cn";
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-sp-3">
      <label className="block text-sm font-bold mb-1.5 text-text-primary font-body">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-sm text-red-700 mt-1 mb-0" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const controlClass =
  "w-full min-h-11 border rounded-sm px-3.5 py-2.5 bg-bg-raised text-text-primary text-base font-body placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors";

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        controlClass,
        invalid ? "border-accent" : "border-border",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        controlClass,
        "min-h-[6rem] resize-y",
        invalid ? "border-accent" : "border-border",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        controlClass,
        invalid ? "border-accent" : "border-border",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3">{children}</div>;
}

export function FieldRow3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-sp-3">{children}</div>;
}
