import { ImageResponse } from "next/og";
import { getProjectBySlug, getWard, projectStatusLabel } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/locales";
import { formatCurrency } from "@/lib/utils";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const project = getProjectBySlug(slug);
  const safeLocale = isLocale(locale) ? (locale as Locale) : "en";

  return new ImageResponse(
    (
      <div tw="flex flex-col justify-between w-full h-full bg-[#fffdf5] text-[#17211c] p-16 font-sans">
        <div tw="text-[28px] font-black text-[#b93336]">
          County Yangu · {getWard(project?.wardId ?? "")?.name ?? "Bungoma"}
        </div>
        <div>
          <div tw="text-[74px] font-black leading-none">
            {project?.title ?? "County project"}
          </div>
          <div tw="mt-7 text-[34px] font-extrabold">
            {project ? formatCurrency(project.budget, safeLocale) : "Budget tracked"} ·{" "}
            {project ? projectStatusLabel(project.status) : "public status"}
          </div>
        </div>
        <div tw="flex gap-[18px]">
          <div tw="w-[70px] h-[70px] rounded-[14px] bg-[#17211c] text-[#f2b33d] flex items-center justify-center text-[30px] font-black">
            CY
          </div>
          <div tw="text-[26px] font-extrabold flex items-center">
            Track the work. Share the proof.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
