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

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <div className="scroll-reveal">
          <HowItWorks />
        </div>
        <div className="scroll-reveal">
          <PackageCards />
        </div>
        <div className="scroll-reveal">
          <VaultSection />
        </div>
        <div className="scroll-reveal">
          <SocialProof />
        </div>
        <div className="scroll-reveal">
          <FAQ />
        </div>
        <div className="scroll-reveal">
          <FinalCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
