'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type NavItem = { name: string; href: string };

export default function AdminMobileNav(props: { nav: NavItem[]; pathname: string }) {
  const { nav, pathname } = props;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        aria-label="Open admin menu"
        aria-expanded={open}
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(22rem,92vw)] bg-white shadow-xl border-r border-gray-200 flex flex-col">
            <div className="h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                  A
                </div>
                <div className="font-semibold text-gray-900">Admin</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                aria-label="Close admin menu"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {nav.map((item) => {
                const active =
                  pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={[
                      'block rounded-md px-3 py-3 text-base font-semibold transition-colors',
                      active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-800 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-3 border-t border-gray-200 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs text-gray-500">
              Use the top-right button to log out.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

