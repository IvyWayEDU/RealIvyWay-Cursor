'use client';

import { HelpCircle } from 'lucide-react';

export default function SupportBubble(props: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { isOpen, onToggle } = props;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isOpen ? 'Close AI Support' : 'Open AI Support'}
      aria-pressed={isOpen}
      className={[
        'fixed bottom-5 right-5 z-[60]',
        'h-12 w-12 rounded-full',
        'bg-[#0088CB] text-white',
        'shadow-lg shadow-black/15',
        'hover:bg-[#0077B3] active:scale-[0.98]',
        'transition-colors transition-transform',
        'focus:outline-none focus:ring-2 focus:ring-[#0088CB]/40 focus:ring-offset-2',
      ].join(' ')}
    >
      <HelpCircle className="h-6 w-6 mx-auto" aria-hidden="true" />
    </button>
  );
}

