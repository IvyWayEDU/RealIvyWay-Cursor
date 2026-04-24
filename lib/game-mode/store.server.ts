import 'server-only';

import crypto from 'crypto';

export type GameModeStatus = 'lobby' | 'in_progress' | 'finished';

export type GameModeQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
};

export type GameModeQuiz = {
  title: string;
  questions: GameModeQuestion[];
};

export type GameModePlayer = {
  userId: string;
  name: string;
  score: number;
  answersByQuestionId: Record<string, { choiceIndex: number; isCorrect: boolean; answeredAtMs: number }>;
};

export type GameModeRoom = {
  id: string;
  createdAtIso: string;
  hostUserId: string;
  hostName: string;
  status: GameModeStatus;
  quiz: GameModeQuiz;
  currentQuestionIndex: number;
  questionStartedAtMs: number | null;
  playersByUserId: Record<string, GameModePlayer>;
};

const GLOBAL_KEY = '__ivyway_game_mode_rooms_v1';
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

type Store = Map<string, GameModeRoom>;

function getStore(): Store {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map<string, GameModeRoom>();
  return g[GLOBAL_KEY] as Store;
}

function cleanupExpiredRooms(store: Store): void {
  const now = Date.now();
  for (const [id, room] of store.entries()) {
    const createdAtMs = new Date(room.createdAtIso).getTime();
    if (!Number.isFinite(createdAtMs)) continue;
    if (now - createdAtMs > ROOM_TTL_MS) store.delete(id);
  }
}

export function createRoomId(): string {
  // Readable room codes, good for sharing on mobile.
  const bytes = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}`;
}

export function createRoom(args: {
  hostUserId: string;
  hostName: string;
  quiz: GameModeQuiz;
}): GameModeRoom {
  const store = getStore();
  cleanupExpiredRooms(store);

  let id = createRoomId();
  while (store.has(id)) id = createRoomId();

  const nowIso = new Date().toISOString();
  const room: GameModeRoom = {
    id,
    createdAtIso: nowIso,
    hostUserId: args.hostUserId,
    hostName: args.hostName,
    status: 'lobby',
    quiz: args.quiz,
    currentQuestionIndex: 0,
    questionStartedAtMs: null,
    playersByUserId: {},
  };

  room.playersByUserId[args.hostUserId] = {
    userId: args.hostUserId,
    name: args.hostName,
    score: 0,
    answersByQuestionId: {},
  };

  store.set(id, room);
  return room;
}

export function getRoom(roomId: string): GameModeRoom | null {
  const id = String(roomId || '').trim().toUpperCase();
  if (!id) return null;
  const store = getStore();
  cleanupExpiredRooms(store);
  return store.get(id) ?? null;
}

export function updateRoom(
  roomId: string,
  updater: (room: GameModeRoom) => void
): GameModeRoom | null {
  const store = getStore();
  cleanupExpiredRooms(store);
  const room = getRoom(roomId);
  if (!room) return null;
  updater(room);
  store.set(room.id, room);
  return room;
}

