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
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#17211c",
          color: "#fffdf5",
          padding: 64,
          fontFamily: "Arial",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900, color: "#f2b33d" }}>
          County Yangu report status
        </div>
        <div>
          <div style={{ fontSize: 72, fontWeight: 900 }}>{report?.reference ?? reference}</div>
          <div style={{ marginTop: 24, fontSize: 34, fontWeight: 800 }}>
            {ward?.name ?? "Bungoma"} · {report?.status.replace(/_/g, " ") ?? "received"}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#d8d2bf" }}>
          Public lookup shows status only. No phone numbers. No report text.
        </div>
      </div>
    ),
    size,
  );
}
