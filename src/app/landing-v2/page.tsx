import { permanentRedirect } from 'next/navigation';

// Extracted utility function for redirecting to the homepage
const redirectToHomepage = () => permanentRedirect('/');

// /landing-v2 was only a staging route for the v2 landing, which now lives at /. 
// Permanently (308) send any remaining traffic and link equity to the homepage.
export default function LandingV2Page() {
  redirectToHomepage();
}