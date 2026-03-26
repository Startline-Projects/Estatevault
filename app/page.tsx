import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import HowItWorks from "@/components/HowItWorks";
import PackageCards from "@/components/PackageCards";
import VaultSection from "@/components/VaultSection";
import SocialProof from "@/components/SocialProof";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <ScrollReveal>
          <HowItWorks />
        </ScrollReveal>
        <ScrollReveal>
          <PackageCards />
        </ScrollReveal>
        <ScrollReveal>
          <VaultSection />
        </ScrollReveal>
        <ScrollReveal>
          <SocialProof />
        </ScrollReveal>
        <ScrollReveal>
          <FAQ />
        </ScrollReveal>
        <ScrollReveal>
          <FinalCTA />
        </ScrollReveal>
      </main>
      <Footer />
    </>
  );
}
