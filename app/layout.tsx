import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SITE_NAME, getSiteUrl } from "@/lib/seo/site";
import { GA4_MEASUREMENT_ID } from "@/lib/analytics/ga4";
import GA4Client from "@/components/analytics/GA4Client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} | Tutoring, College Counseling & IvyWay AI`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Premium academic support: 1:1 tutoring, college counseling, SAT/ACT test prep, virtual college tours, and IvyWay AI study tools.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Tutoring, College Counseling & IvyWay AI`,
    description:
      "Premium academic support: 1:1 tutoring, college counseling, SAT/ACT test prep, virtual college tours, and IvyWay AI study tools.",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Tutoring, College Counseling & IvyWay AI`,
    description:
      "Premium academic support: 1:1 tutoring, college counseling, SAT/ACT test prep, virtual college tours, and IvyWay AI study tools.",
    images: ["/twitter-image"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=2" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png?v=2",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/site.webmanifest?v=2",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA4_MEASUREMENT_ID}', { send_page_view: false });
          `}
        </Script>
        <Suspense fallback={null}>
          <GA4Client />
        </Suspense>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
