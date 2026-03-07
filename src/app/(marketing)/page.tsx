import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PLANS } from "@/config/plans";
import {
  Header,
  HeroSection,
  ValuePropositions,
  HowItWorks,
  ProductFeatures,
  PricingSection,
  Testimonials,
  FAQ,
  FinalCTA,
  Footer,
} from "@/components/landing";

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
