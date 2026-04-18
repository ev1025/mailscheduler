import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // 네이버 Static Map 이미지
      {
        protocol: "https",
        hostname: "naveropenapi.apigw.ntruss.com",
      },
    ],
  },
};

export default nextConfig;
