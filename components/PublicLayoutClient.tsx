'use client';

import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export default function PublicLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Exclude all auth routes from public layout (no header/footer)
  const isAuthPage = pathname?.startsWith('/auth/');
  // Landing page has its own hero-overlay navigation; avoid rendering the standard top header there.
  const isLandingPage = pathname === '/';
  // Legal pages use the landing-style hero header.
  const isLegalPage = pathname === '/privacy' || pathname === '/terms';
  // Marketing pages also use the landing-style hero header.
  const isMarketingPage = pathname === '/faq' || pathname === '/contact' || pathname === '/ivyway-ai';
  const isHeroHeaderPage = isLandingPage || isLegalPage || isMarketingPage;

  return (
    <div className="public-layout flex min-h-screen flex-col bg-white">
      {!isAuthPage && !isHeroHeaderPage && <Navigation />}
      <main className="flex-1 bg-white">{children}</main>
      {!isAuthPage && !isLandingPage && <Footer />}
    </div>
  );
}
