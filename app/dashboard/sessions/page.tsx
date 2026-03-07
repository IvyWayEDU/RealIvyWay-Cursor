/**
 * Provider Sessions Page
 * 
 * Displays upcoming and completed sessions in a two-column layout.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import ProviderSessionsClient from '@/components/ProviderSessionsClient';
import { getProviderByUserId } from '@/lib/providers/storage';

function isDevOrStaging(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (process.env.VERCEL_ENV === 'preview') return true;
  if (process.env.APP_ENV === 'staging') return true;
  if (process.env.NEXT_PUBLIC_APP_ENV === 'staging') return true;
  return false;
}

export default async function SessionsPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  // Check if user is a provider
  const isProvider = session.roles.includes('provider');
  if (!isProvider) {
    redirect('/dashboard/student');
  }

  const providerProfile = await getProviderByUserId(session.userId);
  const isTestAccount =
    Boolean((providerProfile as any)?.is_test_account) || Boolean((providerProfile as any)?.isTestAccount);
  const canUseTestCompletionOverride = isDevOrStaging() || isTestAccount;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage your upcoming and completed sessions.
        </p>
      </div>
      <ProviderSessionsClient canUseTestCompletionOverride={canUseTestCompletionOverride} />
    </div>
  );
}
