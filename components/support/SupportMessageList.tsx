'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';

export type SupportChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: 'normal' | 'ticket_created';
};

function formatInlineLinks(text: string): Array<string | { href: string; label: string }> {
  const parts: Array<string | { href: string; label: string }> = [];
  const raw = String(text || '');

  // Very small internal-link formatter for /dashboard/... paths.
  const re = /(\/dashboard\/[a-z0-9/_-]+)/gi;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIdx) parts.push(raw.slice(lastIdx, start));
    const href = match[0];
    parts.push({ href, label: href });
    lastIdx = end;
  }
  if (lastIdx < raw.length) parts.push(raw.slice(lastIdx));
  return parts;
}

function MessageText({ text }: { text: string }) {
  const parts = useMemo(() => formatInlineLinks(text), [text]);
  return (
    <p className="text-sm whitespace-pre-wrap leading-6">
      {parts.map((p, idx) => {
        if (typeof p === 'string') return <span key={idx}>{p}</span>;
        return (
          <Link
            key={idx}
            href={p.href}
            className="underline underline-offset-2 decoration-current hover:opacity-80"
          >
            {p.label}
          </Link>
        );
      })}
    </p>
  );
}

export default function SupportMessageList(props: {
  messages: SupportChatMessage[];
}) {
  const { messages } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
      {messages.map((m) => {
        const isUser = m.role === 'user';
        return (
          <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[86%]">
              <div
                className={[
                  'rounded-2xl px-4 py-2.5 shadow-sm',
                  isUser
                    ? 'bg-[#0088CB] text-white'
                    : 'bg-white text-gray-800 border border-gray-200',
                ].join(' ')}
              >
                <MessageText text={m.text} />
              </div>

              {m.kind === 'ticket_created' && (
                <div className="mt-2">
                  <Link
                    href="/dashboard/support/tickets"
                    className={[
                      'inline-flex items-center justify-center',
                      'text-xs font-semibold',
                      'px-3 py-1.5 rounded-full',
                      'bg-white border border-gray-200 text-gray-700',
                      'hover:bg-gray-50 hover:border-gray-300',
                      'focus:outline-none focus:ring-2 focus:ring-[#0088CB]/30 focus:border-[#0088CB]/40',
                    ].join(' ')}
                  >
                    View My Support Tickets
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

