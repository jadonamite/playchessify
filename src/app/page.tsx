import ChessifyLanding from '@/components/landing/v2/ChessifyLanding'

const getLandingPageComponent = () => ChessifyLanding;

export default function LandingPage() {
  const LandingPageComponent = getLandingPageComponent();
  return <LandingPageComponent />
}