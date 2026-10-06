import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/session/"],
    },
    sitemap: "https://vivora.ai/sitemap.xml",
  };
}
