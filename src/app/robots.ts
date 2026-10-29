import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export default function robots(): MetadataRoute.Robots {
  const { origin } = loadRuntimeConfig();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin and owner-private account surfaces (including the signed-in home) must not be indexed.
      disallow: routing.locales.flatMap((l) => [`/${l}/admin`, `/${l}/account`, `/${l}/applications`, `/${l}/home`, `/${l}/agents$`]),
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
