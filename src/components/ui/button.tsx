import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-bead-red)] disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" &&
          "bg-[var(--color-charcoal)] text-white hover:bg-[var(--color-cane)]",
        variant === "secondary" &&
          "border border-[var(--color-charcoal)] bg-[var(--color-surface)] text-[var(--color-charcoal)] hover:bg-[var(--color-maize-soft)]",
        variant === "quiet" &&
          "bg-transparent text-[var(--color-charcoal)] hover:bg-black/5",
        variant === "danger" &&
          "bg-[var(--color-bead-red)] text-white hover:bg-[#92272b]",
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  children: ReactNode;
}) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-bead-red)]",
        variant === "primary" &&
          "bg-[var(--color-charcoal)] text-white hover:bg-[var(--color-cane)]",
        variant === "secondary" &&
          "border border-[var(--color-charcoal)] bg-[var(--color-surface)] text-[var(--color-charcoal)] hover:bg-[var(--color-maize-soft)]",
        variant === "quiet" &&
          "bg-transparent text-[var(--color-charcoal)] hover:bg-black/5",
        variant === "danger" &&
          "bg-[var(--color-bead-red)] text-white hover:bg-[#92272b]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
