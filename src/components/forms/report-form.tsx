"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CloudOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { wards } from "@/lib/data";
import { reportSchema, type ReportInput } from "@/lib/schemas";
import { useCountyStore } from "@/lib/store";

const categories = ["Water", "Roads", "Education", "Health", "Waste", "Safety"];

export function ReportForm() {
  const t = useTranslations("report");
  const locale = useLocale();
  const selectedWardId = useCountyStore((state) => state.selectedWardId);
  const setSelectedWard = useCountyStore((state) => state.setSelectedWard);
  const enqueueReport = useCountyStore((state) => state.enqueueReport);
  const [reference, setReference] = useState<string | null>(null);
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      wardId: selectedWardId,
      category: "Water",
      description: "",
      channel: "web",
    },
  });

  function onSubmit(values: ReportInput) {
    const queued = enqueueReport(values);
    setReference(queued.reference ?? null);
  }

  const wardId = watch("wardId");
  const category = watch("category");

  return (
    <form className="grid gap-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-md border border-[var(--color-cane)] bg-[var(--color-bg)] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-1 text-[var(--color-cane)]" />
          <div>
            <p className="font-black">{t("privacyTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{t("privacyBody")}</p>
          </div>
        </div>
      </div>

      <SelectField
        label={t("chooseWard")}
        onValueChange={(value) => {
          setValue("wardId", value, { shouldValidate: true });
          setSelectedWard(value);
        }}
        options={wards.map((ward) => ({ value: ward.id, label: ward.name }))}
        value={wardId}
      />
      {errors.wardId ? <p className="text-sm font-bold text-[var(--color-bead-red)]">{errors.wardId.message}</p> : null}

      <SelectField
        label={t("category")}
        onValueChange={(value) => setValue("category", value, { shouldValidate: true })}
        options={categories.map((item) => ({ value: item, label: item }))}
        value={category}
      />

      <label className="grid gap-2 text-sm font-bold">
        {t("description")}
        <textarea
          className="min-h-36 resize-y rounded-md border border-[var(--color-line)] bg-[var(--color-bg)] p-3 text-base font-medium outline-none focus-visible:border-[var(--color-bead-red)] focus-visible:ring-3 focus-visible:ring-[var(--color-bead-red)]/25"
          placeholder="Example: The classroom site has had no workers for six weeks."
          {...register("description")}
        />
      </label>
      {errors.description ? <p className="text-sm font-bold text-[var(--color-bead-red)]">{errors.description.message}</p> : null}

      <Button type="submit">{t("submit")}</Button>

      {reference ? (
        <div className="rounded-md bg-[var(--color-maize-soft)] p-4" role="status">
          <div className="flex items-start gap-3">
            <CloudOff aria-hidden="true" className="mt-1 text-[var(--color-bead-red)]" />
            <div>
              <p className="font-black">{t("queued")}</p>
              <p className="mt-1 font-data text-xl font-black">{reference}</p>
              <Link className="mt-3 inline-flex font-bold underline" href={`/${locale}/report/${reference}`}>
                {t("lookup")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
