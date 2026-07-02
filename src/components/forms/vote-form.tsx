"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CloudOff, Vote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { getVoteTotals, projectOptions, wards } from "@/lib/data";
import { voteSchema, type VoteInput } from "@/lib/schemas";
import { useCountyStore } from "@/lib/store";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { Locale } from "@/lib/locales";

export function VoteForm({ locale }: { locale: Locale }) {
  const t = useTranslations("vote");
  const selectedWardId = useCountyStore((state) => state.selectedWardId);
  const setSelectedWard = useCountyStore((state) => state.setSelectedWard);
  const enqueueVote = useCountyStore((state) => state.enqueueVote);
  const [confirmation, setConfirmation] = useState<"synced" | "queued" | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VoteInput>({
    resolver: zodResolver(voteSchema),
    defaultValues: {
      wardId: selectedWardId,
      optionId:
        projectOptions.find((option) => option.wardId === selectedWardId)?.id ??
        projectOptions[0].id,
      channel: "web",
    },
  });

  const wardId = watch("wardId");
  const optionId = watch("optionId");
  const optionsForWard = useMemo(
    () => projectOptions.filter((option) => option.wardId === wardId),
    [wardId],
  );
  const visibleOptions = optionsForWard.length > 0 ? optionsForWard : projectOptions;

  function updateWard(value: string) {
    setValue("wardId", value, { shouldValidate: true });
    setSelectedWard(value);
    const firstOption = projectOptions.find((option) => option.wardId === value);
    setValue("optionId", firstOption?.id ?? projectOptions[0].id, {
      shouldValidate: true,
    });
  }

  function onSubmit(values: VoteInput) {
    enqueueVote(values);
    setConfirmation(navigator.onLine ? "synced" : "queued");
  }

  return (
    <form
      className="grid gap-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5"
      onSubmit={handleSubmit(onSubmit)}
    >
      <SelectField
        label={t("chooseWard")}
        onValueChange={updateWard}
        options={wards.map((ward) => ({ value: ward.id, label: ward.name }))}
        value={wardId}
      />
      {errors.wardId ? <p className="text-sm font-bold text-[var(--color-bead-red)]">{errors.wardId.message}</p> : null}

      <SelectField
        label={t("chooseProject")}
        onValueChange={(value) => setValue("optionId", value, { shouldValidate: true })}
        options={visibleOptions.map((option) => ({
          value: option.id,
          label: `${option.title} - ${formatCurrency(option.amount, locale)}`,
        }))}
        value={optionId}
      />
      {errors.optionId ? <p className="text-sm font-bold text-[var(--color-bead-red)]">{errors.optionId.message}</p> : null}

      <div className="grid gap-3">
        {visibleOptions.map((option) => {
          const total = getVoteTotals(option);
          const largest = Math.max(...visibleOptions.map(getVoteTotals));
          return (
            <button
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-bg)] p-3 text-left transition hover:border-[var(--color-cane)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-[var(--color-bead-red)]"
              key={option.id}
              onClick={() => setValue("optionId", option.id, { shouldValidate: true })}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{option.title}</p>
                  <p className="text-sm leading-6 text-[var(--color-muted)]">{option.description}</p>
                </div>
                <span className="rounded bg-[var(--color-maize-soft)] px-2 py-1 font-data text-sm font-black">
                  {formatNumber(total, locale)}
                </span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-black/10">
                <div
                  className="h-3 rounded-full bg-[var(--color-cane)]"
                  style={{ width: `${Math.max(9, (total / largest) * 100)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <Button type="submit">
        <Vote aria-hidden="true" size={18} />
        {t("submit")}
      </Button>

      {confirmation ? (
        <div className="flex items-start gap-3 rounded-md bg-[var(--color-maize-soft)] p-3" role="status">
          {confirmation === "synced" ? (
            <CheckCircle2 aria-hidden="true" className="mt-1 text-[var(--color-cane)]" />
          ) : (
            <CloudOff aria-hidden="true" className="mt-1 text-[var(--color-bead-red)]" />
          )}
          <div>
            <p className="font-black">
              {confirmation === "synced" ? t("recorded") : t("queued")}
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              {confirmation === "synced"
                ? "The tally is already reflected in this demo."
                : "It will move from waiting to synced when connectivity returns."}
            </p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
