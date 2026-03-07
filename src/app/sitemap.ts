import type { MetadataRoute } from "next";

const baseUrl =
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "https://finplaner.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = [
    "",
    "/login",
    "/register",
    "/forgot-password",
    "/billing",
  ];

  return publicPaths.map((path) => ({
    url: `${baseUrl.replace(/\/$/, "")}${path ? `/${path}` : ""}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly" as const,
    priority: path === "" ? 1 : 0.8,
  }));
}
