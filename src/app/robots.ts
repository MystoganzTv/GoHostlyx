import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXTAUTH_URL ?? "https://gohostlyx.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authenticated app surfaces and APIs out of search indexes.
      disallow: ["/dashboard", "/api", "/onboarding", "/settings", "/profile", "/login"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
