import { permanentRedirect } from 'next/navigation';

// Extracted utility function for handling redirects
function handlePermanentRedirect(url: string) {
  permanentRedirect(url);
}

// /landing-v2 was only a staging route for the v2 landing, which now lives at /. 
// Permanently (308) send any remaining traffic and link equity to the homepage.
export default function LandingV2Page() {
  handlePermanentRedirect('/');
}