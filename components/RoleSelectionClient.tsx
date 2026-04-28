'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type RoleChoice = 'student' | 'provider';

export default function RoleSelectionClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selected, setSelected] = useState<RoleChoice | null>(null);

  const title = useMemo(() => 'Select your role', []);

  async function submit(choice: RoleChoice) {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to set role. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const redirectTo = typeof data?.redirectTo === 'string' && data.redirectTo ? data.redirectTo : '/dashboard';
      router.replace(redirectTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set role. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100svh] bg-white">
      {/* Modal-style locked onboarding */}
      <div className="fixed inset-0 bg-[#06233A]/35 backdrop-blur-[6px]" />
      <div className="fixed inset-0 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[520px] rounded-2xl bg-white shadow-[0_24px_80px_rgba(6,35,58,0.20)] ring-1 ring-[#06233A]/10">
          <div className="px-6 sm:px-8 pt-7 pb-6">
            <div className="text-sm font-semibold tracking-[0.14em] text-[#0088CB]">ONBOARDING</div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-[#06233A]">{title}</h1>
            <p className="mt-2 text-sm text-[#06233A]/70">
              This helps us route you to the right dashboard and onboarding flow.
            </p>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="text-sm font-medium text-red-800">{error}</div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => setSelected('student')}
                disabled={isSubmitting}
                className={[
                  'w-full rounded-2xl border px-5 py-5 text-left transition-colors',
                  selected === 'student'
                    ? 'border-[#0088CB]/40 bg-[#0088CB]/[0.06]'
                    : 'border-[#06233A]/10 bg-white hover:bg-[#06233A]/[0.02]',
                  isSubmitting ? 'opacity-60 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <div className="text-lg font-semibold text-[#06233A]">Student</div>
                <div className="mt-1 text-sm text-[#06233A]/70">Go straight to your student dashboard.</div>
              </button>

              <button
                type="button"
                onClick={() => setSelected('provider')}
                disabled={isSubmitting}
                className={[
                  'w-full rounded-2xl border px-5 py-5 text-left transition-colors',
                  selected === 'provider'
                    ? 'border-[#0088CB]/40 bg-[#0088CB]/[0.06]'
                    : 'border-[#06233A]/10 bg-white hover:bg-[#06233A]/[0.02]',
                  isSubmitting ? 'opacity-60 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <div className="text-lg font-semibold text-[#06233A]">Tutor / Counselor</div>
                <div className="mt-1 text-sm text-[#06233A]/70">Continue into provider onboarding (profile, qualifications, availability).</div>
              </button>
            </div>

            <div className="mt-6">
              <button
                type="button"
                disabled={!selected || isSubmitting}
                onClick={() => selected && submit(selected)}
                className="w-full rounded-xl bg-[#0088CB] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving…' : 'Continue'}
              </button>
              <div className="mt-3 text-xs text-[#06233A]/55">
                You’ll only need to do this once.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

