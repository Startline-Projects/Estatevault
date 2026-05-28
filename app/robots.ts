import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/pro/", "/sales/", "/attorney/", "/api/", "/auth/", "/trustee/", "/farewell/"],
      },
    ],
    sitemap: "https://estatevault.us/sitemap.xml",
  };
}
