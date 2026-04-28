import { permanentRedirect } from 'next/navigation';

export default function PricingPage() {
  // Pricing lives on the landing page only (/#pricing).
  // Keep /pricing as a compatibility entrypoint.
  permanentRedirect('/#pricing');
}
