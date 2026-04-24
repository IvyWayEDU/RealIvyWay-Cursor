import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { getRoom, updateRoom, type GameModeQuestion, type GameModeRoom } from '@/lib/game-mode/store.server';

export const runtime = 'nodejs';

type PublicQuestion = {
  id: string;
  prompt: string;
  choices: string[];
};

function toPublicRoom(room: GameModeRoom, requesterUserId: string) {
  const isHost = requesterUserId === room.hostUserId;
  const currentQuestion = room.quiz.questions[room.currentQuestionIndex] ?? null;
  const currentQuestionId = currentQuestion?.id ?? null;

  const questionsPublic: PublicQuestion[] = room.quiz.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    choices: q.choices,
  }));

  const players = Object.values(room.playersByUserId).map((p) => ({
    userId: p.userId,
    name: p.name,
    score: p.score,
    hasAnsweredCurrent: currentQuestionId ? Boolean(p.answersByQuestionId[currentQuestionId]) : false,
  }));

  const revealAnswers = room.status === 'finished';
  const questionsWithAnswers = revealAnswers
    ? room.quiz.questions.map((q) => ({
        id: q.id,
        correctIndex: q.correctIndex,
        explanation: q.explanation ?? '',
      }))
    : [];

  return {
    id: room.id,
    createdAtIso: room.createdAtIso,
    status: room.status,
    hostUserId: room.hostUserId,
    hostName: room.hostName,
    isHost,
    quiz: { title: room.quiz.title, questions: questionsPublic },
    currentQuestionIndex: room.currentQuestionIndex,
    questionStartedAtMs: room.questionStartedAtMs,
    players,
    revealAnswers,
    answers: questionsWithAnswers,
  };
}

type ActionBody =
  | { action: 'join'; name?: unknown }
  | { action: 'start' }
  | { action: 'next' }
  | { action: 'finish' }
  | { action: 'answer'; choiceIndex?: unknown };

function getActiveQuestion(room: GameModeRoom): GameModeQuestion | null {
  const q = room.quiz.questions[room.currentQuestionIndex];
  return q ?? null;
}

export async function GET(_: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  const auth = await getAuthContext();
  if (auth.status === 'suspended') {
    return Response.json({ error: 'Account suspended' }, { status: 403 });
  }
  if (auth.status !== 'ok') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomId } = await ctx.params;
  const room = getRoom(roomId);
  if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

  return Response.json(toPublicRoom(room, auth.session.userId), { status: 200 });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  const auth = await getAuthContext();
  if (auth.status === 'suspended') {
    return Response.json({ error: 'Account suspended' }, { status: 403 });
  }
  if (auth.status !== 'ok') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { roomId } = await ctx.params;
  const existing = getRoom(roomId);
  if (!existing) return Response.json({ error: 'Room not found' }, { status: 404 });

  let body: ActionBody | null = null;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = (body as any)?.action;
  if (action !== 'join' && action !== 'start' && action !== 'next' && action !== 'finish' && action !== 'answer') {
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }

  const userId = auth.session.userId;
  const updated = updateRoom(roomId, (room) => {
    if (action === 'join') {
      const name =
        typeof (body as any)?.name === 'string' && String((body as any).name).trim()
          ? String((body as any).name).trim().slice(0, 40)
          : auth.session.name || 'Player';

      const existingPlayer = room.playersByUserId[userId];
      room.playersByUserId[userId] = existingPlayer
        ? { ...existingPlayer, name }
        : { userId, name, score: 0, answersByQuestionId: {} };
      return;
    }

    const isHost = userId === room.hostUserId;
    if ((action === 'start' || action === 'next' || action === 'finish') && !isHost) {
      return;
    }

    if (action === 'start') {
      if (room.status !== 'lobby') return;
      room.status = 'in_progress';
      room.currentQuestionIndex = 0;
      room.questionStartedAtMs = Date.now();
      return;
    }

    if (action === 'next') {
      if (room.status !== 'in_progress') return;
      const nextIdx = room.currentQuestionIndex + 1;
      if (nextIdx >= room.quiz.questions.length) {
        room.status = 'finished';
        room.questionStartedAtMs = null;
        return;
      }
      room.currentQuestionIndex = nextIdx;
      room.questionStartedAtMs = Date.now();
      return;
    }

    if (action === 'finish') {
      room.status = 'finished';
      room.questionStartedAtMs = null;
      return;
    }

    if (action === 'answer') {
      if (room.status !== 'in_progress') return;
      const q = getActiveQuestion(room);
      if (!q) return;
      const choiceIndexRaw = (body as any)?.choiceIndex;
      const choiceIndex =
        typeof choiceIndexRaw === 'number'
          ? choiceIndexRaw
          : typeof choiceIndexRaw === 'string'
            ? parseInt(choiceIndexRaw, 10)
            : NaN;
      if (!Number.isFinite(choiceIndex)) return;
      if (choiceIndex < 0 || choiceIndex >= q.choices.length) return;

      const player =
        room.playersByUserId[userId] ??
        (room.playersByUserId[userId] = {
          userId,
          name: auth.session.name || 'Player',
          score: 0,
          answersByQuestionId: {},
        });

      if (player.answersByQuestionId[q.id]) return; // lock first answer
      const isCorrect = choiceIndex === q.correctIndex;
      player.answersByQuestionId[q.id] = { choiceIndex, isCorrect, answeredAtMs: Date.now() };
      if (isCorrect) player.score += 1;
      return;
    }
  });

  // If a non-host tried to run host-only actions, updater is a no-op; return current state.
  const finalRoom = updated ?? getRoom(roomId);
  if (!finalRoom) return Response.json({ error: 'Room not found' }, { status: 404 });

  return Response.json(toPublicRoom(finalRoom, auth.session.userId), { status: 200 });
}

