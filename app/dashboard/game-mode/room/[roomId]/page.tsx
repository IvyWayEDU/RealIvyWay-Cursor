import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import GameModeRoomClient from './roomClient';

export default async function GameModeRoomPage(props: { params: Promise<{ roomId: string }> }) {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  const { roomId } = await props.params;
  const normalizedRoomId = String(roomId || '').trim().toUpperCase();
  if (!normalizedRoomId) redirect('/dashboard/game-mode');

  return (
    <div className="space-y-6">
      <GameModeRoomClient roomId={normalizedRoomId} currentUserName={session.name || 'Player'} />
    </div>
  );
}

