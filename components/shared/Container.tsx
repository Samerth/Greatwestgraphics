import { cn } from "@/lib/utils/cn";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-container px-4 md:px-8 xl:px-24", className)}>
      {children}
    </div>
  );
}
