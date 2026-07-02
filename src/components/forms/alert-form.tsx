"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { wards } from "@/lib/data";
import { alertSchema, type AlertInput } from "@/lib/schemas";
import { useCountyStore } from "@/lib/store";

export function AlertForm() {
  const t = useTranslations("alerts");
  const selectedWardId = useCountyStore((state) => state.selectedWardId);
  const [done, setDone] = useState(false);
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AlertInput>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      wardId: selectedWardId,
      channel: "sms",
      phoneHint: "",
    },
  });

  function onSubmit() {
    setDone(true);
  }

  return (
    <form className="grid gap-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5" onSubmit={handleSubmit(onSubmit)}>
      <SelectField
        label="Ward"
        onValueChange={(value) => setValue("wardId", value, { shouldValidate: true })}
        options={wards.map((ward) => ({ value: ward.id, label: ward.name }))}
        value={watch("wardId")}
      />
      <SelectField
        label="Channel"
        onValueChange={(value) => setValue("channel", value as AlertInput["channel"], { shouldValidate: true })}
        options={[
          { value: "sms", label: t("channelSms") },
          { value: "ussd", label: t("channelUssd") },
        ]}
        value={watch("channel")}
      />
      <label className="grid gap-2 text-sm font-bold">
        {t("lastDigits")}
        <input
          className="min-h-12 rounded-md border border-[var(--color-line)] bg-[var(--color-bg)] px-3 text-base font-semibold outline-none focus-visible:border-[var(--color-bead-red)] focus-visible:ring-3 focus-visible:ring-[var(--color-bead-red)]/25"
          inputMode="numeric"
          maxLength={4}
          {...register("phoneHint")}
        />
      </label>
      {errors.phoneHint ? <p className="text-sm font-bold text-[var(--color-bead-red)]">{errors.phoneHint.message}</p> : null}
      <Button type="submit">
        <BellRing aria-hidden="true" size={18} />
        {t("submit")}
      </Button>
      {done ? (
        <p className="rounded-md bg-[var(--color-maize-soft)] p-3 font-black" role="status">
          {t("done")}
        </p>
      ) : null}
    </form>
  );
}
