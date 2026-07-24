import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // SanMar's media CDN — enabled once real product images come from
    // BulkData / Media Content instead of the local /public/images set.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.sanmarcanada.com",
      },
    ],
  },
};

export default nextConfig;
