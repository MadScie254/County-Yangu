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
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fffdf5",
          color: "#17211c",
          padding: 64,
          fontFamily: "Arial",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900, color: "#b93336" }}>
          County Yangu · {getWard(project?.wardId ?? "")?.name ?? "Bungoma"}
        </div>
        <div>
          <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1 }}>
            {project?.title ?? "County project"}
          </div>
          <div style={{ marginTop: 28, fontSize: 34, fontWeight: 800 }}>
            {project ? formatCurrency(project.budget, safeLocale) : "Budget tracked"} ·{" "}
            {project ? projectStatusLabel(project.status) : "public status"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <div style={{ width: 70, height: 70, borderRadius: 14, background: "#17211c", color: "#f2b33d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900 }}>
            CY
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center" }}>
            Track the work. Share the proof.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
