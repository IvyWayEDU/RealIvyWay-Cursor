import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createRoom } from '@/lib/game-mode/store.server';
import { generateGameModeQuiz } from '@/lib/game-mode/quiz.server';

export const runtime = 'nodejs';

type CreateRoomBody = {
  topic?: unknown;
  questionCount?: unknown;
  difficulty?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (auth.status === 'suspended') {
    return Response.json({ error: 'Account suspended' }, { status: 403 });
  }
  if (auth.status !== 'ok') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateRoomBody | null = null;
  try {
    body = (await request.json()) as CreateRoomBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return Response.json({ error: 'Topic is required' }, { status: 400 });
  }

  const questionCountRaw =
    typeof body?.questionCount === 'number'
      ? body.questionCount
      : typeof body?.questionCount === 'string'
        ? parseInt(body.questionCount, 10)
        : 8;
  const questionCount = Number.isFinite(questionCountRaw) ? Number(questionCountRaw) : 8;

  const difficultyRaw = typeof body?.difficulty === 'string' ? body.difficulty.trim().toLowerCase() : 'medium';
  const difficulty: 'easy' | 'medium' | 'hard' =
    difficultyRaw === 'easy' ? 'easy' : difficultyRaw === 'hard' ? 'hard' : 'medium';

  let quiz;
  try {
    quiz = await generateGameModeQuiz({ topic, questionCount, difficulty });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to generate quiz' },
      { status: 502 }
    );
  }

  const room = createRoom({
    hostUserId: auth.session.userId,
    hostName: auth.session.name || 'Host',
    quiz,
  });

  return Response.json(
    {
      roomId: room.id,
      roomUrl: `/dashboard/game-mode/room/${encodeURIComponent(room.id)}`,
    },
    { status: 200 }
  );
}

