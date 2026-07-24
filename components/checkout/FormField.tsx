import { cn } from "@/lib/utils/cn";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

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
      <label className="block text-[13px] font-bold mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[12.5px] text-accent mt-1">{error}</p>}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        "w-full border rounded-sm px-3 py-2.5 bg-bg-raised focus:outline-none focus:border-accent transition-colors",
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
        "w-full border rounded-sm px-3 py-2.5 bg-bg-raised focus:outline-none focus:border-accent transition-colors",
        invalid ? "border-accent" : "border-border",
        className
      )}
      {...props}
    />
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3">{children}</div>;
}

export function FieldRow3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-sp-3">{children}</div>;
}
