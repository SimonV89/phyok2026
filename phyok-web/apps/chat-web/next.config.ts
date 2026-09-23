import type { NextConfig } from "next";

const localBffOrigin = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3002";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    return [
      {
        source: "/v2/:path*",
        destination: `${localBffOrigin}/v2/:path*`
      }
    ];
  }
};

export default nextConfig;
