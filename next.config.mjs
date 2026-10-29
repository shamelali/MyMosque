/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit loads .afm font metrics from its package at runtime; keep it unbundled.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
