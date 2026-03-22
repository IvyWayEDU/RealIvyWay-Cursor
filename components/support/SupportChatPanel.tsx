'use client';

import { X, Send } from 'lucide-react';

import SupportMessageList, { type SupportChatMessage } from './SupportMessageList';
import SupportQuickActions, { type SupportQuickAction } from './SupportQuickActions';

export default function SupportChatPanel(props: {
  open: boolean;
  onClose: () => void;
  messages: SupportChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  quickActions: SupportQuickAction[];
  onPickQuickAction: (message: string) => void;
  isBusy?: boolean;
}) {
  const {
    open,
    onClose,
    messages,
    draft,
    onDraftChange,
    onSend,
    quickActions,
    onPickQuickAction,
    isBusy,
  } = props;

  return (
    <div
      className={[
        'fixed z-[60] bottom-[76px] right-5',
        'w-[360px] max-w-[calc(100vw-2.5rem)]',
        'h-[520px] max-h-[70vh]',
        'rounded-2xl bg-white border border-gray-200 shadow-xl shadow-black/10',
        'overflow-hidden',
        'transition-all duration-200',
        open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none',
      ].join(' ')}
      role="dialog"
      aria-modal="false"
      aria-label="AI Support"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">AI Support</p>
            <p className="mt-0.5 text-xs text-gray-500">Ask a question or get help fast</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={[
              'shrink-0 h-8 w-8 rounded-full',
              'hover:bg-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-[#0088CB]/30',
              'grid place-items-center',
            ].join(' ')}
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-600" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col h-[calc(520px-56px)] max-h-[calc(70vh-56px)]">
        {messages.length === 0 && (
          <div className="bg-gray-50 pt-4">
            <div className="px-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">Hi — how can I help?</p>
                <p className="mt-1 text-xs text-gray-600">
                  Ask about booking, joining sessions, payments, or support tickets.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <SupportQuickActions actions={quickActions} onPick={onPickQuickAction} />
            </div>
          </div>
        )}

        <SupportMessageList messages={messages} />

        {/* Composer */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Type your question…"
              rows={1}
              className={[
                'flex-1 resize-none',
                'px-3 py-2.5 text-sm',
                'rounded-2xl border border-gray-300 bg-white',
                'focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent',
              ].join(' ')}
              disabled={Boolean(isBusy)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={Boolean(isBusy) || !draft.trim()}
              className={[
                'h-10 w-10 rounded-full grid place-items-center',
                'bg-[#0088CB] text-white',
                'hover:bg-[#0077B3] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-[#0088CB]/40 focus:ring-offset-2',
              ].join(' ')}
              aria-label="Send"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Tip: Press Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      </div>
    </div>
  );
}

