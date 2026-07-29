import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@gwg/contracts", "@gwg/pricing"],
  images: {
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
