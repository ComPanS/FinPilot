import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PLANS } from "@/config/plans";
import { Header } from "@/components/landing/header";
import { HeroSection } from "@/components/landing/hero-section";
import { ValuePropositions } from "@/components/landing/value-propositions";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ProductFeatures } from "@/components/landing/product-features";
import { PricingSection } from "@/components/landing/pricing-section";
import { Testimonials } from "@/components/landing/testimonials";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Прогноз кассовых разрывов онлайн — сервис для ИП за 5 минут",
  description:
    "Онлайн-сервис для ИП: прогноз кассовых разрывов и денежных потоков за 5 минут. Найди дефицит денег заранее и управляй финансами без Excel.",
  alternates: { canonical: "/" },
};

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const displayPlans = [PLANS.FREE, PLANS.STANDARD, PLANS.PRO];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <ValuePropositions />
        <HowItWorks />
        <ProductFeatures />
        <PricingSection plans={displayPlans} />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
