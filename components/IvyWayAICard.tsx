'use client';

import Link from 'next/link';

type IvyWayAiEntryPoint = 'student_dashboard' | 'provider_dashboard';

export default function IvyWayAICard({
  entryPoint,
  description,
}: {
  entryPoint: IvyWayAiEntryPoint;
  description: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[#0088CB]/15 bg-gradient-to-br from-white via-white to-blue-50 shadow-sm">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#0088CB]/12 blur-3xl" />
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
            <span className="inline-flex items-center rounded-full border border-[#0088CB]/20 bg-white/70 px-3 py-1 text-xs font-semibold text-[#006FA6] backdrop-blur">
              Built in to your dashboard
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white/70 p-5 shadow-sm transition hover:border-[#0088CB]/30 hover:bg-white">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#0088CB]/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#006FA6]">Ask instantly</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">Ask IvyWay AI</div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0088CB]/10 ring-1 ring-[#0088CB]/15">
                  <svg
                    className="h-5 w-5 text-[#0088CB]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3.75h5.25M12 20.25a8.25 8.25 0 110-16.5 8.25 8.25 0 010 16.5z"
                    />
                  </svg>
                </div>
              </div>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Get explanations, quizzes, flashcards, and step-by-step help in seconds.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={`/dashboard/ai/chat?source=dashboard&entry=${encodeURIComponent(entryPoint)}`}
                  className="inline-flex w-full items-center justify-center rounded-md bg-[#0088CB] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] sm:w-auto"
                >
                  Ask IvyWay AI
                </Link>
                <Link
                  href="/dashboard/ai"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#006FA6] hover:text-[#005C8A] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] w-fit"
                >
                  <span>Open IvyWay AI</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6.75L19.5 12l-6 5.25M4.5 12h15" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white/70 p-5 shadow-sm transition hover:border-[#0088CB]/30 hover:bg-white">
            <div className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      Premium Feature
                    </span>
                    <span className="text-xs font-medium text-gray-500">Multiplayer</span>
                  </div>
                  <div className="mt-2 text-lg font-semibold text-gray-900">IvyWay Game Mode</div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/15">
                  <svg
                    className="h-5 w-5 text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 18.75h-9A2.25 2.25 0 015.25 16.5v-9A2.25 2.25 0 017.5 5.25h9A2.25 2.25 0 0118.75 7.5v9a2.25 2.25 0 01-2.25 2.25z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 13.5h7.5" />
                  </svg>
                </div>
              </div>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Create live quiz battles with friends, classmates, or study groups.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0088CB]/70" />
                  <span>Compete live with friends</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0088CB]/70" />
                  <span>Create AI-generated quiz battles</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                Examples: SAT prep battles, AP Biology challenge rooms, math speed rounds, vocabulary competitions.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/dashboard/game-mode"
                  className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 sm:w-auto"
                >
                  Create Quiz Battles
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#006FA6] hover:text-[#005C8A] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] w-fit"
                >
                  <span>View premium access</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.8"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6.75L19.5 12l-6 5.25M4.5 12h15" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

