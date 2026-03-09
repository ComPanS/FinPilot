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
  title:
    "ФинПланер — прогноз кассовых разрывов для ИП и разных бизнесов на основе доходов и расходов",
  description:
    "Кассовый планировщик для ИП: прогноз денежных потоков на 3 месяца за 5 минут. Узнай кассовые разрывы до того, как они произойдут. Без Excel.",
  keywords: [
    "кассовый разрыв",
    "прогноз кассовых разрывов",
    "управленка для ИП",
    "кассовый планировщик",
    "прогноз денежных потоков",
    "ИП",
    "микробизнес",
    "денежные потоки",
    "ФинПланер",
    "без Excel",
  ],
  robots: { index: true, follow: true },
  verification: {
    google: "yVHBM6NxpQ8WjkH9BBTOa1OTGoLDGfZfMiSnvG9WFUI",
    yandex: "817448a5d525c4eb",
  },
  category: "finance",
  alternates: { canonical: siteUrl },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title:
      "ФинПланер — прогноз кассовых разрывов для ИП и разных бизнесов на основе доходов и расходов",
    description:
      "Кассовый планировщик для ИП: прогноз денежных потоков на 3 месяца за 5 минут. Узнай кассовые разрывы до того, как они произойдут. Без Excel.",
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
    title:
      "ФинПланер — прогноз кассовых разрывов для ИП и разных бизнесов на основе доходов и расходов",
    description:
      "Кассовый планировщик для ИП: прогноз денежных потоков на 3 месяца за 5 минут. Узнай кассовые разрывы до того, как они произойдут. Без Excel.",
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
