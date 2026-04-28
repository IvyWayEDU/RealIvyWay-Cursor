'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ProviderAvailabilityPrompt(props: { show: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.show) setOpen(true);
  }, [props.show]);

  async function dismiss() {
    setOpen(false);
    try {
      await fetch('/api/onboarding/dismiss-availability-prompt', { method: 'POST' });
    } catch {
      // Non-blocking
    }
  }

  async function goSetAvailability() {
    setSaving(true);
    try {
      await fetch('/api/onboarding/dismiss-availability-prompt', { method: 'POST' });
    } catch {
      // Non-blocking
    }
    router.push('/dashboard/availability');
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-[#06233A]/35 backdrop-blur-[6px]" />

      <div className="absolute inset-0 flex items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-[520px] rounded-2xl bg-white shadow-[0_24px_80px_rgba(6,35,58,0.20)] ring-1 ring-[#06233A]/10">
          <button
            type="button"
            aria-label="Close"
            onClick={dismiss}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#06233A]/55 hover:text-[#06233A] hover:bg-[#06233A]/[0.04] transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div className="px-6 sm:px-8 pt-7 pb-6">
            <div className="text-sm font-semibold tracking-[0.14em] text-[#0088CB]">ONBOARDING</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#06233A]">Set Your Availability</h2>
            <p className="mt-2 text-sm leading-6 text-[#06233A]/70">
              Students can only book sessions during times you make available. Set your schedule now so students can
              start booking with you.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[#06233A]/70 hover:text-[#06233A] hover:bg-[#06233A]/[0.04] transition-colors"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={goSetAvailability}
                disabled={saving}
                className="rounded-xl bg-[#0088CB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Opening…' : 'Set Availability'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

