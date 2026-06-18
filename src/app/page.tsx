import Features from '@/components/landing/Features';
import Hero from '@/components/landing/Hero';
import { FreeCTA, Footer } from '@/components/landing/CTAFooter';

const renderMainContent = () => {
  return (
    <> 
      <Hero />
      <Features />
      <FreeCTA />
      <Footer />
    </>
  );
};

export default function LandingPage() {
  return (
    <main>
      {renderMainContent()}
    </main>
  );
}