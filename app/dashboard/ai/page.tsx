import { redirect } from 'next/navigation';

import { getAuthContext } from '@/lib/auth/session';
import { createIvyWayAiSsoJwt } from '@/lib/ivywayai/ssoJwt.server';

export const dynamic = 'force-dynamic';

export default async function IvyWayAIPage() {
  const auth = await getAuthContext();
  if (auth.status === 'suspended') {
    redirect('/auth/login?error=suspended');
  }
  if (auth.status !== 'ok') {
    redirect('/auth/login');
  }

  const token = createIvyWayAiSsoJwt({
    userId: auth.session.userId,
    email: auth.session.email,
  });

  const encodedToken = encodeURIComponent(token);
  const iframeSrc = `https://ivywayai.com/sso?token=${encodedToken}`;

  return (
    <div className="-m-8 flex h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] min-h-0 overflow-hidden bg-white">
      <iframe
        title="IvyWay AI"
        src={iframeSrc}
        className="block h-full w-full flex-1"
        style={{ border: 0 }}
      />
    </div>
  );
}

