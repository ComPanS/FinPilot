import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { ValuePropositions } from "./components/ValuePropositions";
import { HowItWorks } from "./components/HowItWorks";
import { ProductFeatures } from "./components/ProductFeatures";
import { PricingSection } from "./components/PricingSection";
import { Testimonials } from "./components/Testimonials";
import { FAQ } from "./components/FAQ";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <ValuePropositions />
        <HowItWorks />
        <ProductFeatures />
        <PricingSection />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
