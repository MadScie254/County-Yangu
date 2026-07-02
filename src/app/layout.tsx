import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "@fontsource/public-sans/latin-400.css";
import "@fontsource/public-sans/latin-600.css";
import "@fontsource/public-sans/latin-700.css";
import "@fontsource/public-sans/latin-800.css";
import "@fontsource/public-sans/latin-900.css";
import "@fontsource/roboto-mono/latin-400.css";
import "@fontsource/roboto-mono/latin-700.css";
import "@fontsource/barrio/latin-400.css";
import "./globals.css";

const description =
  "County Yangu is Bungoma County's citizen-first public participation platform for votes, anonymous reports, project tracking, alerts, and public analytics.";

export const metadata: Metadata = {
  applicationName: "County Yangu",
  title: {
    default: "County Yangu | Bungoma public participation",
    template: "%s | County Yangu",
  },
  description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://county-yangu.vercel.app",
  ),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "County Yangu",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "County Yangu",
    title: "County Yangu",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "County Yangu",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#285A3A",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className="h-full"
      data-scroll-behavior="smooth"
      lang="en"
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
