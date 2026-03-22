'use client';

import Link from 'next/link';
import { getIvyWayAiLinks, IvyWayAiEntryPoint } from '@/lib/ivyway-ai/links';

export default function IvyWayAICard({
  entryPoint,
  description,
}: {
  entryPoint: IvyWayAiEntryPoint;
  description: string;
}) {
  const links = getIvyWayAiLinks(entryPoint);

  return (
    <section className="relative overflow-hidden rounded-xl border border-[#0088CB]/15 bg-gradient-to-br from-white via-white to-blue-50 shadow-sm">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#0088CB]/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-28 -bottom-28 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0088CB]/10 ring-1 ring-[#0088CB]/15">
                <svg
                  className="h-6 w-6 text-[#0088CB]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">IvyWay AI</h2>
                <p className="mt-1 text-sm text-gray-600">{description}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Free Trial Available
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={links.startFreeTrial.href}
            target={links.startFreeTrial.external ? '_blank' : undefined}
            rel={links.startFreeTrial.external ? 'noreferrer' : undefined}
            className="inline-flex items-center justify-center rounded-md bg-[#0088CB] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
          >
            Start Free Trial
          </Link>

          <Link
            href={links.upgradeToFullAccess.href}
            target={links.upgradeToFullAccess.external ? '_blank' : undefined}
            rel={links.upgradeToFullAccess.external ? 'noreferrer' : undefined}
            className="inline-flex items-center justify-center rounded-md border border-[#0088CB]/30 bg-white px-5 py-2.5 text-sm font-semibold text-[#006FA6] shadow-sm transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
          >
            Upgrade to Full Access
          </Link>

          <Link
            href={links.openIvyWayAi.href}
            target={links.openIvyWayAi.external ? '_blank' : undefined}
            rel={links.openIvyWayAi.external ? 'noreferrer' : undefined}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
          >
            Open IvyWay AI
          </Link>
        </div>
      </div>
    </section>
  );
}

