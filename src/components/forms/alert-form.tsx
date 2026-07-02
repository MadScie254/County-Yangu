"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
    control,
    register,
    setValue,
    formState: { errors },
  } = useForm<AlertInput>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      wardId: selectedWardId,
      channel: "sms",
      phoneNumber: "",
    },
  });

  function onSubmit() {
    setDone(true);
  }

  const wardId = useWatch({ control, name: "wardId" });
  const channel = useWatch({ control, name: "channel" });

  return (
    <form className="grid gap-5 rounded-xl border border-white/50 bg-white/80 backdrop-blur-sm p-4 shadow-xl sm:p-5" onSubmit={handleSubmit(onSubmit)}>
      <SelectField
        label="Ward"
        onValueChange={(value) => setValue("wardId", value, { shouldValidate: true })}
        options={wards.map((ward) => ({ value: ward.id, label: ward.name }))}
        value={wardId}
      />
      <SelectField
        label="Channel"
        onValueChange={(value) => setValue("channel", value as AlertInput["channel"], { shouldValidate: true })}
        options={[
          { value: "sms", label: t("channelSms") },
          { value: "ussd", label: t("channelUssd") },
          { value: "whatsapp", label: "WhatsApp Message" },
        ]}
        value={channel}
      />
      <label className="grid gap-2 text-sm font-bold">
        Phone Number
        <input
          className="min-h-12 rounded-md border border-[var(--color-line)] bg-white/50 px-3 text-base font-semibold outline-none transition-all focus-visible:border-[var(--color-maize)] focus-visible:ring-4 focus-visible:ring-[var(--color-maize)]/30"
          inputMode="tel"
          type="tel"
          placeholder="e.g. 0712 345 678"
          {...register("phoneNumber")}
        />
      </label>
      {errors.phoneNumber ? <p className="text-sm font-bold text-[var(--color-bead-red)]">{errors.phoneNumber.message}</p> : null}
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
