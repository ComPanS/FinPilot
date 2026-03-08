import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_ADMIN_PATH:
      process.env.ADMIN_PATH ||
      process.env.NEXT_PUBLIC_ADMIN_PATH ||
      "",
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"],
  },
  async rewrites() {
    const adminPath =
      process.env.ADMIN_PATH || process.env.NEXT_PUBLIC_ADMIN_PATH || "";
    if (!adminPath) return [];
    return {
      beforeFiles: [
        { source: `/${adminPath}`, destination: "/admin?internal=1" },
        { source: `/${adminPath}/`, destination: "/admin?internal=1" },
      ],
    };
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://yastatic.net https://mc.yandex.ru https://mc.yandex.com https://*.yandex.ru",
      "frame-src 'self' https://autofill.yandex.ru https://oauth.yandex.ru https://login.yandex.ru https://*.yandex.ru https://yastatic.net",
      "connect-src 'self' blob: https://mc.yandex.ru https://mc.yandex.com https://*.yandex.ru https://*.yandex.net https://yastatic.net",
      "img-src 'self' data: blob: https: https://mc.yandex.ru https://mc.yandex.com https://*.yandex.ru https://*.yandex.net",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;
