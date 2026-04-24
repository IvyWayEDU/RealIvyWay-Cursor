import Link from 'next/link';

export default function IvyWayAICard() {
  return (
    <section className="rounded-2xl border border-[#0088CB]/15 bg-white p-6 shadow-sm transition duration-200 hover:border-[#0088CB]/25 hover:shadow-md sm:p-8">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 shrink-0 text-[#0088CB]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 2.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.455L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.455-2.455L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.455L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.455 2.455Z"
          />
        </svg>
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Try IvyWay AI</h2>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-6 text-gray-600 sm:text-base">
        Study smarter with AI powered tutoring, flashcards, quiz battles, and step by step explanations.
      </p>

      <ul className="mt-5 space-y-3">
        <li className="flex items-start gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0088CB]" />
          <span className="text-sm text-gray-800 sm:text-base">
            Premium Game Mode (multiplayer quiz battles with friends)
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0088CB]" />
          <span className="text-sm text-gray-800 sm:text-base">AI Chat for instant homework help</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0088CB]" />
          <span className="text-sm text-gray-800 sm:text-base">Flashcard Generator</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0088CB]" />
          <span className="text-sm text-gray-800 sm:text-base">Quiz Maker</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0088CB]" />
          <span className="text-sm text-gray-800 sm:text-base">Problem Solving Camera</span>
        </li>
      </ul>

      <div className="mt-6">
        <Link
          href="/dashboard/ai"
          className="inline-flex w-full items-center justify-center rounded-md bg-[#0088CB] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
        >
          Ask IvyWay AI
        </Link>
      </div>
    </section>
  );
}
