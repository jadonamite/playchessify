import Features from '@/components/landing/Features';
import Hero from '@/components/landing/Hero';
import { FreeCTA, Footer } from '@/components/landing/CTAFooter';

const getMainContent = () => (
  <>
    <Hero />
    <Features />
    <FreeCTA />
    <Footer />
  </>
);

export default function LandingPage() {
  return (
    <main>
      {getMainContent()}
    </main>
  );
}