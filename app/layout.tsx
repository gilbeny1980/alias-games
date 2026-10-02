import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-blue-800">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
