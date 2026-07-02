"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { wards } from "@/lib/data";
import { type Locale } from "@/lib/locales";
import { proposeSchema, type ProposeInput } from "@/lib/schemas";
import { useCountyStore } from "@/lib/store";

export function ProposeForm({ locale }: { locale: Locale }) {
  const t = useTranslations("propose");
  const proposeProject = useCountyStore((state) => state.proposeProject);
  const selectedWardId = useCountyStore((state) => state.selectedWardId);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProposeInput>({
    resolver: zodResolver(proposeSchema),
    defaultValues: {
      wardId: selectedWardId,
    },
  });

  if (success) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[var(--color-cane)] bg-[var(--color-cane)]/10 p-8 text-center shadow-sm">
        <CheckCircle2 className="text-[var(--color-cane)]" size={64} />
        <h2 className="mt-6 font-display text-3xl font-black text-[var(--color-charcoal)]">
          {t("success")}
        </h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Your project proposal has been submitted to the community board.
        </p>
        <Button className="mt-8" onClick={() => setSuccess(false)}>
          Submit Another Proposal
        </Button>
      </div>
    );
  }

  return (
    <form
      className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-sm md:p-8"
      onSubmit={handleSubmit((data) => {
        proposeProject(data);
        setSuccess(true);
      })}
    >
      <h2 className="font-display text-2xl font-black">{t("title")}</h2>
      <p className="mt-2 text-[var(--color-muted)]">{t("intro")}</p>

      <div className="mt-8 grid gap-6">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">{t("projectTitle")}</span>
          <input
            className="w-full rounded-md border border-[var(--color-line)] bg-white px-4 py-3 outline-none focus-visible:border-[var(--color-charcoal)] focus-visible:ring-1 focus-visible:ring-[var(--color-charcoal)]"
            placeholder="e.g. Expand Lwandanyi Market"
            {...register("title")}
          />
          {errors.title && (
            <p className="mt-2 text-sm font-bold text-[var(--color-bead-red)]">{errors.title.message}</p>
          )}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold">{t("ward")}</span>
          <select
            className="w-full appearance-none rounded-md border border-[var(--color-line)] bg-white px-4 py-3 outline-none focus-visible:border-[var(--color-charcoal)] focus-visible:ring-1 focus-visible:ring-[var(--color-charcoal)]"
            {...register("wardId")}
          >
            <option disabled value="">
              Select...
            </option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.name}
              </option>
            ))}
          </select>
          {errors.wardId && (
            <p className="mt-2 text-sm font-bold text-[var(--color-bead-red)]">{errors.wardId.message}</p>
          )}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold">{t("description")}</span>
          <textarea
            className="min-h-[120px] w-full resize-y rounded-md border border-[var(--color-line)] bg-white px-4 py-3 outline-none focus-visible:border-[var(--color-charcoal)] focus-visible:ring-1 focus-visible:ring-[var(--color-charcoal)]"
            placeholder="Describe the problem and your proposed solution..."
            {...register("description")}
          />
          {errors.description && (
            <p className="mt-2 text-sm font-bold text-[var(--color-bead-red)]">{errors.description.message}</p>
          )}
        </label>

        <div>
          <span className="mb-2 block text-sm font-bold">{t("photo")}</span>
          <div className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-line)] bg-[var(--color-bg)] py-10 transition-colors hover:border-[var(--color-charcoal)]">
            <Camera className="text-[var(--color-muted)]" size={32} />
            <p className="mt-2 text-sm font-bold text-[var(--color-charcoal)]">Click to take or upload a photo</p>
          </div>
        </div>

        <Button className="mt-4" type="submit">
          <Upload size={18} />
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
