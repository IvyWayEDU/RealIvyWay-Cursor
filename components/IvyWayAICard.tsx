import Link from 'next/link';
import Image from 'next/image';

export default function IvyWayAICard() {
  return (
    <section className="rounded-2xl border border-[#0088CB]/15 bg-white p-6 shadow-sm transition duration-200 hover:border-[#0088CB]/25 hover:shadow-md sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#0088CB]/15 bg-white">
          <Image src="/logo/ivyway-logo.png" alt="IvyWay" width={40} height={40} className="h-7 w-auto" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">IvyWay AI</h2>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-6 text-gray-600 sm:text-base">
        Study smarter with AI powered tutoring, flashcards, quiz battles, and step by step explanations.
      </p>

      <ul className="mt-5 space-y-3">
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
        <li className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0088CB]" />
            <span className="text-sm text-gray-800 sm:text-base">
              Premium Game Mode (multiplayer quiz battles with friends)
            </span>
          </div>
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
            Premium
          </span>
        </li>
      </ul>

      <div className="mt-6">
        <Link
          href="/dashboard/ai"
          className="inline-flex w-full items-center justify-center rounded-md bg-[#0088CB] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
        >
          Ask IvyWay AI
        </Link>

        <Link
          href="/dashboard/game-mode"
          className="mt-3 inline-flex w-full justify-center text-sm font-semibold text-[#006FA6] hover:text-[#005C8A] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
        >
          Explore Premium Game Mode
        </Link>
      </div>
    </section>
  );
}
