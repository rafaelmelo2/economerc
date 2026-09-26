import { createFileRoute, redirect } from "@tanstack/react-router";

import { CatalaoSection } from "@/components/landing/catalao-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { PillarsSection } from "@/components/landing/pillars-section";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (useAuthStore.getState().accessToken) {
      throw redirect({ to: "/historico" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <LandingHeader />
      <main>
        <HeroSection />
        <PillarsSection />
        <CatalaoSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
