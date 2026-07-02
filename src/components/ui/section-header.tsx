import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow ? (
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-bead-red)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-4xl font-bold tracking-tight leading-[1.04] text-[var(--color-charcoal)] sm:text-6xl">
        {title}
      </h1>
      {children ? (
        <p className="mt-4 text-lg leading-8 text-[var(--color-muted)]">
          {children}
        </p>
      ) : null}
    </div>
  );
}
