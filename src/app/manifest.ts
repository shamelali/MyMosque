import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistem Pengurusan Masjid Johor",
    short_name: "SPMJ",
    description:
      "Tadbir urus masjid, kewangan, derma, qurban dan kelas Al-Quran — untuk AJK, jemaah dan pegawai JAINJ.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ee",
    theme_color: "#0c2f22",
    lang: "ms",
    categories: ["government", "finance", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Derma", url: "/jemaah/derma" },
      { name: "Tempah Kelas Quran", url: "/jemaah/quran" },
      { name: "Portal Masjid", url: "/portal" },
    ],
  };
}
