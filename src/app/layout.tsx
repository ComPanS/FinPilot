import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:
      "Прогноз кассовых разрывов онлайн — сервис для ИП за 5 минут | ФинПланер",
    template: "%s | ФинПланер",
  },
  description:
    "Онлайн-сервис для ИП: прогноз кассовых разрывов и денежных потоков за 5 минут. Найди дефицит денег заранее и управляй финансами без Excel.",
  keywords: [
  "кассовый разрыв",
  "прогноз кассовых разрывов онлайн",
  "денежный поток прогноз",
  "cash flow прогноз",
  "кассовый планировщик онлайн",
  "финансовый учет для ИП",
  "управление денежными потоками",
  "сервис для ИП финансы",
  "планирование бюджета ИП",
  "финансовая модель для ИП"
],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
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
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Прогноз кассовых разрывов за 5 минут — ФинПланер",
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
