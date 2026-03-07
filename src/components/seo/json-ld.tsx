const baseUrl =
  process.env.APP_URL || process.env.NEXTAUTH_URL || "https://finplaner.ru";

const siteUrl = baseUrl.replace(/\/$/, "");

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ФинПланер",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description:
    "Кассовый планировщик для ИП и микробизнеса. Прогноз денежных потоков на 3 месяца.",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ФинПланер",
  url: siteUrl,
  description:
    "Кассовый планировщик для ИП и микробизнеса. Управленка за 5 минут.",
  publisher: {
    "@type": "Organization",
    name: "ФинПланер",
    logo: `${siteUrl}/logo.png`,
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ФинПланер",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Кассовый планировщик для ИП и микробизнеса. Прогноз денежных потоков на 3 месяца вперёд, выявление кассовых разрывов и персональные рекомендации.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "RUB",
  },
};

export function JsonLd() {
  const jsonLd = [organizationJsonLd, websiteJsonLd, softwareJsonLd];

  return (
    <>
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(data).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
