import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

// Vercel provides the production domain automatically, so NEXT_PUBLIC_SITE_URL is optional
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Alias Games - משחק מילים",
  description: "משחק הסברת מילים בקבוצות, אונליין עם חברים",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Alias Games" },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
  openGraph: {
    title: "Alias Games - משחק מילים",
    description: "מצטרפים לחדר ומשחקים אליאס עם חברים, ישר מהטלפון",
    url: "/",
    siteName: "Alias Games",
    locale: "he_IL",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-red-800">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
