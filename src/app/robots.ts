import type { MetadataRoute } from "next";

import { loadRuntimeConfig } from "@/lib/runtime/config";

export default function robots(): MetadataRoute.Robots {
  const { origin } = loadRuntimeConfig();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin and owner-private account surfaces must not be indexed.
      disallow: ["/admin", "/applications", "/agents$"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
