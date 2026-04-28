'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Footer() {
  const router = useRouter();
  const pathname = usePathname();

  const goToLandingSection = (id: 'pricing' | 'faq') => {
    if (pathname === '/') {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    router.push(`/#${id}`);
  };

  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="border-t border-[#06233A]/10 py-10">
          <div className="flex flex-col items-center justify-between gap-10 sm:flex-row sm:items-start">
            <div className="text-center sm:text-left">
              <div className="text-sm font-semibold text-[#06233A]">IvyWay</div>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-[#06233A]/55 sm:justify-start">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16)]"
                />
                <span>All systems operational</span>
              </div>
              <div className="mt-3 text-xs text-[#06233A]/50">&copy; 2026 IvyWay. All rights reserved.</div>
            </div>

            <div className="grid grid-cols-3 gap-x-10 gap-y-8 text-center sm:text-left">
              <div>
                <div className="text-xs font-semibold tracking-[0.12em] text-[#06233A]">ABOUT</div>
                <div className="mt-3 space-y-2 text-sm font-medium text-[#06233A]/70">
                  <Link
                    href="/#pricing"
                    onClick={(e) => {
                      e.preventDefault();
                      goToLandingSection('pricing');
                    }}
                    className="block hover:text-[#06233A] transition-colors"
                  >
                    Pricing
                  </Link>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold tracking-[0.12em] text-[#06233A]">SUPPORT</div>
                <div className="mt-3 space-y-2 text-sm font-medium text-[#06233A]/70">
                  <Link
                    href="/#faq"
                    onClick={(e) => {
                      e.preventDefault();
                      goToLandingSection('faq');
                    }}
                    className="block hover:text-[#06233A] transition-colors"
                  >
                    FAQ
                  </Link>
                  <a href="mailto:contact@ivywayedu.com" className="block hover:text-[#06233A] transition-colors">
                    Contact Us
                  </a>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold tracking-[0.12em] text-[#06233A]">LEGAL</div>
                <div className="mt-3 space-y-2 text-sm font-medium text-[#06233A]/70">
                  <Link href="/privacy" className="block hover:text-[#06233A] transition-colors">
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className="block hover:text-[#06233A] transition-colors">
                    Terms of Service
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

