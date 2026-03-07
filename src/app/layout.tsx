import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/components/providers/query-provider";
import { ConditionalFooter } from "@/components/layout/conditional-footer";
import { JsonLd } from "@/components/seo/json-ld";
import { YandexMetrika } from "@/components/analytics/yandex-metrika";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const baseUrl =
  process.env.APP_URL || process.env.NEXTAUTH_URL || "https://finplaner.ru";

const siteUrl = baseUrl.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ФинПланер — Управленка за 5 минут",
  description:
    "Кассовый планировщик для ИП и микробизнеса. Прогноз денежных потоков на 3 месяца.",
  keywords: [
    "кассовый планировщик",
    "ИП",
    "микробизнес",
    "денежные потоки",
    "прогноз",
    "кассовые разрывы",
    "ФинПланер",
  ],
  robots: { index: true, follow: true },
  category: "finance",
  alternates: { canonical: siteUrl },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "ФинПланер — Управленка за 5 минут",
    description:
      "Кассовый планировщик для ИП и микробизнеса. Прогноз денежных потоков на 3 месяца.",
    locale: "ru_RU",
    type: "website",
    siteName: "ФинПланер",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "ФинПланер",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ФинПланер — Управленка за 5 минут",
    description:
      "Кассовый планировщик для ИП и микробизнеса. Прогноз денежных потоков на 3 месяца.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        <YandexMetrika />
        <JsonLd />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
        >
          <div className="flex min-h-screen flex-col">
            <div className="flex flex-1 flex-col">
              <QueryProvider>{children}</QueryProvider>
            </div>
            <ConditionalFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
