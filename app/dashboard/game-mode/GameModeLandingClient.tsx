'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Difficulty = 'easy' | 'medium' | 'hard';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function GameModeLandingClient() {
  const router = useRouter();

  const [topic, setTopic] = useState('SAT Math speed round');
  const [questionCount, setQuestionCount] = useState(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const normalizedJoinCode = useMemo(() => joinCode.trim().toUpperCase(), [joinCode]);

  const canCreate = topic.trim().length >= 3 && !isCreating;
  const canJoin = normalizedJoinCode.length >= 4;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await fetch('/api/game-mode/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), questionCount, difficulty }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setCreateError(typeof data?.error === 'string' ? data.error : 'Could not create room.');
        return;
      }
      const roomUrl = typeof data?.roomUrl === 'string' ? data.roomUrl : '';
      if (!roomUrl) {
        setCreateError('Room created but no URL was returned.');
        return;
      }
      router.push(roomUrl);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setIsCreating(false);
    }
  }, [canCreate, difficulty, questionCount, router, topic]);

  const handleJoin = useCallback(() => {
    if (!canJoin) return;
    router.push(`/dashboard/game-mode/room/${encodeURIComponent(normalizedJoinCode)}`);
  }, [canJoin, normalizedJoinCode, router]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Create Quiz Battles</h2>
        <p className="mt-1 text-sm text-gray-600">
          Pick a topic and IvyWay AI will generate a battle-ready quiz room you can share.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Battle topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB]/20"
              placeholder="AP Biology challenge room"
              autoComplete="off"
            />
            <div className="mt-2 text-xs text-gray-500">
              Examples: SAT prep battles, AP Biology challenge rooms, Math speed rounds, Vocabulary competitions
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Questions</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB]/20"
              >
                {[5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Difficulty</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={classNames(
                      'rounded-md border px-3 py-2 text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]',
                      difficulty === d
                        ? 'border-[#0088CB]/30 bg-[#0088CB]/10 text-[#006FA6]'
                        : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                    )}
                  >
                    {d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {createError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {createError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className={classNames(
                'inline-flex w-full items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] sm:w-auto',
                canCreate ? 'bg-gray-900 hover:bg-black' : 'bg-gray-400'
              )}
            >
              {isCreating ? 'Creating...' : 'Create Quiz Battle'}
            </button>
            <a
              href="/pricing"
              className="inline-flex w-full items-center justify-center rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] sm:w-auto"
            >
              Premium Feature
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Join a room</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter the room code from a friend, tutor, or study group.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Room code</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB]/20"
              placeholder="AB12-CD34"
              autoComplete="off"
            />
          </div>

          <button
            type="button"
            onClick={handleJoin}
            disabled={!canJoin}
            className={classNames(
              'inline-flex w-full items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]',
              canJoin ? 'bg-[#0088CB] hover:bg-[#0077B3]' : 'bg-gray-400'
            )}
          >
            Join room
          </button>

          <div className="rounded-lg border border-[#0088CB]/15 bg-blue-50 px-4 py-3 text-sm text-gray-700">
            <div className="font-semibold text-gray-900">How it works</div>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              <li>- Create a room and share the code</li>
              <li>- Everyone joins from their dashboard</li>
              <li>- Host starts the battle and players answer live</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

