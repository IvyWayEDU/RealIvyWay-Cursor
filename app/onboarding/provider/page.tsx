import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getOnboardingStatus } from '@/lib/auth/onboarding';
import ProviderOnboardingClient from '@/components/ProviderOnboardingClient';

export default async function OnboardingProviderPage() {
  // Verify session exists
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  if (!Array.isArray(session.roles) || session.roles.length === 0) {
    redirect('/onboarding/role');
  }

  // Check if user is a provider
  const isProvider = session.roles.includes('provider');
  if (!isProvider) {
    // Students should never see this flow
    redirect('/dashboard/student');
  }

  // Check if onboarding is already completed
  const onboardingStatus = await getOnboardingStatus();
  if (onboardingStatus.completed) {
    redirect('/dashboard/provider');
  }

  return <ProviderOnboardingClient initialUser={onboardingStatus.user} />;
}


