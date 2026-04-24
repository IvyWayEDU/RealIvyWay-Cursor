import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import GameModeLandingClient from './GameModeLandingClient';

export default async function GameModeLandingPage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            Premium Feature
          </span>
          <span className="text-xs font-medium text-gray-500">Multiplayer</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">IvyWay Game Mode</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Create live quiz battles with friends, classmates, or study groups. AI generates the quiz, you compete in real time.
        </p>
      </div>

      <GameModeLandingClient />
    </div>
  );
}

