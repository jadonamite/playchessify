import { permanentRedirect } from 'next/navigation'

// /landing-v2 was only a staging route for the v2 landing, which now lives at /. 
// Permanently (308) send any remaining traffic and link equity to the homepage.
const HOMEPAGE_URL = '/';

export default function LandingV2Page() {
  return permanentRedirect(HOMEPAGE_URL)
}