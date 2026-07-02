import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "County Yangu",
    short_name: "County Yangu",
    description:
      "Bungoma County public participation for voting, anonymous reports, project tracking, and ward alerts.",
    start_url: "/en",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFDF5",
    theme_color: "#285A3A",
    icons: [
      {
        src: "/icons/county-yangu.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/county-yangu.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    categories: ["government", "utilities", "news"],
    lang: "en-KE",
  };
}
