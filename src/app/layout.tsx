import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: {
    default: "SPMJ — Sistem Pengurusan Masjid Johor",
    template: "%s · SPMJ",
  },
  description:
    "Platform pengurusan masjid negeri Johor: tadbir urus, kewangan, selenggaraan, kuliah, derma, qurban dan tempahan kelas Al-Quran.",
  applicationName: "SPMJ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SPMJ",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c2f22",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
