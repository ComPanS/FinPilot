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
      "frame-src 'self' blob: https://mc.yandex.ru https://mc.webvisor.com https://mc.webvisor.org https://autofill.yandex.ru https://oauth.yandex.ru https://login.yandex.ru https://*.yandex.ru https://yastatic.net",
      "child-src 'self' blob: https://mc.yandex.ru https://mc.webvisor.com https://mc.webvisor.org",
      "connect-src 'self' blob: https://mc.yandex.ru https://mc.yandex.az https://mc.yandex.by https://mc.yandex.co.il https://mc.yandex.com https://mc.yandex.com.am https://mc.yandex.com.ge https://mc.yandex.com.tr https://mc.yandex.ee https://mc.yandex.fr https://mc.yandex.kg https://mc.yandex.kz https://mc.yandex.lt https://mc.yandex.lv https://mc.yandex.md https://mc.yandex.tj https://mc.yandex.tm https://mc.yandex.uz https://mc.webvisor.com https://mc.webvisor.org https://yastatic.net wss://mc.yandex.ru wss://mc.yandex.az wss://mc.yandex.by wss://mc.yandex.co.il wss://mc.yandex.com wss://mc.yandex.com.am wss://mc.yandex.com.ge wss://mc.yandex.com.tr wss://mc.yandex.ee wss://mc.yandex.fr wss://mc.yandex.kg wss://mc.yandex.kz wss://mc.yandex.lt wss://mc.yandex.lv wss://mc.yandex.md wss://mc.yandex.tj wss://mc.yandex.tm wss://mc.yandex.uz wss://mc.webvisor.com wss://mc.webvisor.org",
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
