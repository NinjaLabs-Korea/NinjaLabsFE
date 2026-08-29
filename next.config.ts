import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.NINJA_API_BASE_URL?.replace(/\/$/, "");
    return apiUrl
      ? [{ source: "/media/:path*", destination: `${apiUrl}/media/:path*` }]
      : [];
  },
};

export default nextConfig;
