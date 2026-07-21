import type { MetadataRoute } from "next";

import { loadRuntimeConfig } from "@/lib/runtime/config";

export default function robots(): MetadataRoute.Robots {
  const { origin } = loadRuntimeConfig();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Demo-only surfaces: public-chrome admin preview and owner-private session views.
      disallow: ["/admin", "/applications", "/agents$"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
