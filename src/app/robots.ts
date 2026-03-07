import type { MetadataRoute } from "next";

const baseUrl =
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "https://finplaner.ru";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/cashflow", "/fact", "/what-if", "/insights", "/reports", "/settings", "/onboarding", "/profiles/"],
    },
    sitemap: `${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
