import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.NINJA_API_BASE_URL?.replace(/\/$/, "");
    return apiUrl
      ? [{ source: "/media/:path*", destination: `${apiUrl}/media/:path*` }]
      : [];
  },
};

export default withNextIntl(nextConfig);
