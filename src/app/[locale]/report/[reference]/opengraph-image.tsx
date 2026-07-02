import { ImageResponse } from "next/og";
import { getReport, getWard } from "@/lib/data";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const report = getReport(reference);
  const ward = report ? getWard(report.wardId) : null;

  return new ImageResponse(
    (
      <div tw="flex flex-col justify-between w-full h-full bg-[#17211c] text-[#fffdf5] p-16 font-sans">
        <div tw="text-[28px] font-black text-[#f2b33d]">
          County Yangu report status
        </div>
        <div>
          <div tw="text-[72px] font-black">{report?.reference ?? reference}</div>
          <div tw="mt-6 text-[34px] font-extrabold">
            {ward?.name ?? "Bungoma"} · {report?.status.replace(/_/g, " ") ?? "received"}
          </div>
        </div>
        <div tw="text-[26px] font-extrabold text-[#d8d2bf]">
          Public lookup shows status only. No phone numbers. No report text.
        </div>
      </div>
    ),
    size,
  );
}
