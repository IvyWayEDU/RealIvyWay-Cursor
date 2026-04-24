'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type PublicRoom = {
  id: string;
  status: 'lobby' | 'in_progress' | 'finished';
  hostUserId: string;
  hostName: string;
  isHost: boolean;
  quiz: {
    title: string;
    questions: Array<{ id: string; prompt: string; choices: string[] }>;
  };
  currentQuestionIndex: number;
  questionStartedAtMs: number | null;
  players: Array<{ userId: string; name: string; score: number; hasAnsweredCurrent: boolean }>;
  revealAnswers: boolean;
  answers: Array<{ id: string; correctIndex: number; explanation: string }>;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatRoomCode(id: string): string {
  return String(id || '').toUpperCase();
}

export default function GameModeRoomClient(props: { roomId: string; currentUserName: string }) {
  const { roomId } = props;
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState(props.currentUserName);
  const [joined, setJoined] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollingRef = useRef<number | null>(null);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/game-mode/rooms/${encodeURIComponent(roomId)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setLoadError(typeof data?.error === 'string' ? data.error : 'Room unavailable.');
        return;
      }
      setLoadError(null);
      setRoom(data as PublicRoom);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Network error.');
    }
  }, [roomId]);

  const postAction = useCallback(
    async (payload: any) => {
      setActionError(null);
      try {
        const res = await fetch(`/api/game-mode/rooms/${encodeURIComponent(roomId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          setActionError(typeof data?.error === 'string' ? data.error : 'Action failed.');
          return;
        }
        setRoom(data as PublicRoom);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Network error.');
      }
    },
    [roomId]
  );

  useEffect(() => {
    void fetchRoom();
    pollingRef.current = window.setInterval(() => void fetchRoom(), 1200);
    const tick = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      window.clearInterval(tick);
    };
  }, [fetchRoom]);

  const currentQuestion = useMemo(() => {
    if (!room) return null;
    return room.quiz.questions[room.currentQuestionIndex] ?? null;
  }, [room]);

  const timeLeft = useMemo(() => {
    if (!room || room.status !== 'in_progress') return null;
    if (!room.questionStartedAtMs) return null;
    const durationMs = 20_000;
    const elapsed = nowMs - room.questionStartedAtMs;
    const remaining = Math.max(0, durationMs - elapsed);
    return Math.ceil(remaining / 1000);
  }, [nowMs, room]);

  const myHasAnsweredCurrent = useMemo(() => {
    if (!room || !currentQuestion) return false;
    const me = room.players.find((p) => p.name === name) ?? null;
    // Fallback: if name differs, rely on server flag by comparing to "answered current" for all players is not safe.
    // We still let server lock first answer, so this is only a UI hint.
    return me ? me.hasAnsweredCurrent : false;
  }, [currentQuestion, name, room]);

  const handleJoin = useCallback(async () => {
    if (isSaving) return;
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    setIsSaving(true);
    try {
      await postAction({ action: 'join', name: trimmed });
      setJoined(true);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, name, postAction]);

  const handleStart = useCallback(() => void postAction({ action: 'start' }), [postAction]);
  const handleNext = useCallback(() => void postAction({ action: 'next' }), [postAction]);
  const handleFinish = useCallback(() => void postAction({ action: 'finish' }), [postAction]);
  const handleAnswer = useCallback((choiceIndex: number) => void postAction({ action: 'answer', choiceIndex }), [postAction]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <div className="text-sm font-semibold">Could not open room</div>
        <div className="mt-1 text-sm">{loadError}</div>
        <div className="mt-4">
          <Link
            href="/dashboard/game-mode"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black"
          >
            Back to Game Mode
          </Link>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-600">Loading room...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-500">Room</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-xl font-bold text-gray-900">{formatRoomCode(room.id)}</div>
              <span className="inline-flex items-center rounded-full border border-[#0088CB]/20 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#006FA6]">
                {room.status === 'lobby' ? 'Lobby' : room.status === 'in_progress' ? 'Live' : 'Finished'}
              </span>
              {room.isHost ? (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-800">
                  Host
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Quiz: <span className="font-semibold text-gray-900">{room.quiz.title}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="text-sm text-gray-600">
              Host: <span className="font-semibold text-gray-900">{room.hostName}</span>
            </div>
            <Link
              href="/dashboard/game-mode"
              className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
            >
              Create another room
            </Link>
          </div>
        </div>
      </section>

      {!joined ? (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Join this room</h2>
          <p className="mt-1 text-sm text-gray-600">Pick your display name and join the battle.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB]/20 sm:max-w-sm"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={isSaving || name.trim().length < 1}
              className={classNames(
                'inline-flex w-full items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors sm:w-auto',
                !isSaving && name.trim().length >= 1 ? 'bg-[#0088CB] hover:bg-[#0077B3]' : 'bg-gray-400'
              )}
            >
              {isSaving ? 'Joining...' : 'Join'}
            </button>
          </div>
          {actionError ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {actionError}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Players</h2>
            <div className="text-sm text-gray-500">{room.players.length}</div>
          </div>
          <div className="mt-4 space-y-2">
            {room.players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <div key={p.userId} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.hasAnsweredCurrent ? 'Answered' : room.status === 'in_progress' ? 'Answering' : 'Ready'}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{p.score}</div>
                </div>
              ))}
          </div>

          {room.isHost ? (
            <div className="mt-5 space-y-2">
              {room.status === 'lobby' ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black"
                >
                  Start battle
                </button>
              ) : null}
              {room.status === 'in_progress' ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black"
                >
                  Next question
                </button>
              ) : null}
              {room.status !== 'finished' ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="inline-flex w-full items-center justify-center rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                >
                  End battle
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-[#0088CB]/15 bg-blue-50 px-4 py-3 text-sm text-gray-700">
              Waiting for <span className="font-semibold text-gray-900">{room.hostName}</span> to start.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          {room.status === 'lobby' ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Lobby</h2>
              <p className="mt-1 text-sm text-gray-600">
                Share the code <span className="font-semibold text-gray-900">{formatRoomCode(room.id)}</span> so others can join.
              </p>
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Tip: Everyone joins from <span className="font-semibold text-gray-900">Dashboard → IvyWay Game Mode</span>.
              </div>
            </div>
          ) : null}

          {room.status === 'in_progress' && currentQuestion ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#006FA6]">
                    Question {room.currentQuestionIndex + 1} of {room.quiz.questions.length}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900">{currentQuestion.prompt}</h2>
                </div>
                {typeof timeLeft === 'number' ? (
                  <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-semibold text-gray-900">
                    {timeLeft}s
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentQuestion.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAnswer(idx)}
                    disabled={!joined || myHasAnsweredCurrent || (typeof timeLeft === 'number' && timeLeft <= 0)}
                    className={classNames(
                      'rounded-lg border px-4 py-3 text-left text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]',
                      !joined || myHasAnsweredCurrent || (typeof timeLeft === 'number' && timeLeft <= 0)
                        ? 'border-gray-200 bg-gray-50 text-gray-500'
                        : 'border-gray-200 bg-white text-gray-900 hover:bg-blue-50 hover:border-[#0088CB]/30'
                    )}
                  >
                    {choice}
                  </button>
                ))}
              </div>

              {actionError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {actionError}
                </div>
              ) : null}
            </div>
          ) : null}

          {room.status === 'finished' ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Battle finished</h2>
                <p className="mt-1 text-sm text-gray-600">Scores are final. Create a new room to run it back.</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">Answer key</div>
                <div className="mt-3 space-y-3">
                  {room.quiz.questions.map((q, idx) => {
                    const ans = room.answers.find((a) => a.id === q.id);
                    const correct = ans ? q.choices[ans.correctIndex] : '';
                    return (
                      <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="text-sm font-semibold text-gray-900">
                          {idx + 1}. {q.prompt}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          Correct: <span className="font-semibold text-gray-900">{correct}</span>
                        </div>
                        {ans?.explanation ? (
                          <div className="mt-1 text-sm text-gray-600">{ans.explanation}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

