import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Local LAN / 127.0.0.1 access during `next dev` (Server Actions + /_next assets).
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@gwg/contracts", "@gwg/pricing"],
  images: {
    // Next 16 defaults to quality 75 only. The studio and some <Image>
    // calls ask for 90; without this the optimizer returns 400 and the
    // design canvas stays blank.
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.sanmarcanada.com",
      },
      {
        protocol: "https",
        hostname: "www.ssactivewear.com",
      },
      {
        protocol: "https",
        hostname: "cdn.ssactivewear.com",
      },
    ],
  },
};

export default nextConfig;
