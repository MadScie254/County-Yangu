"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Choose",
  className,
}: {
  label: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("grid gap-2", className)}>
      <label className="text-sm font-bold text-[var(--color-charcoal)]" id={id}>
        {label}
      </label>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger
          aria-labelledby={id}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-left text-base font-semibold text-[var(--color-charcoal)] shadow-sm outline-none focus-visible:border-[var(--color-bead-red)] focus-visible:ring-3 focus-visible:ring-[var(--color-bead-red)]/25"
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown aria-hidden="true" size={18} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="z-50 max-h-72 overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-xl">
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item
                  className="relative flex min-h-11 cursor-pointer select-none items-center rounded px-9 py-2 text-sm font-semibold text-[var(--color-charcoal)] outline-none data-[highlighted]:bg-[var(--color-maize-soft)]"
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemIndicator className="absolute left-3 inline-flex items-center">
                    <Check aria-hidden="true" size={16} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
