'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getDashboardLatestMessages, type DashboardMessagePreview } from '@/lib/messages/actions';

type MessagesSectionProps = {
  userId: string;
  subtitle: string;
  emptySubtitle: string;
};

function formatPreviewTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (hours < 1) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function MessagesSection({ userId, subtitle, emptySubtitle }: MessagesSectionProps) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<DashboardMessagePreview[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getDashboardLatestMessages(userId);
        if (cancelled) return;
        setMessages(res);
      } catch {
        if (cancelled) return;
        setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      console.log('Dashboard messages:', messages);
    }
  }, [loading, messages]);

  const hasMessages = messages.length > 0;
  const previewRows = useMemo(
    () =>
      messages.slice(0, 5).map((m) => ({
        ...m,
        timeLabel: formatPreviewTime(m.created_at),
        bodyPreview: (m.body || '').trim() || '(No text)',
      })),
    [messages]
  );

  return (
    <Link
      href="/dashboard/messages"
      className="block overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-[#0088CB]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
            <p className="mt-1 text-sm text-gray-500">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-3/4 rounded bg-gray-100" />
            <div className="h-4 w-2/3 rounded bg-gray-100" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
          </div>
        ) : hasMessages ? (
          <div className="space-y-4">
            {previewRows.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{m.bodyPreview}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">From:</span> {m.sender_id}
                  </p>
                </div>
                <div className="flex-shrink-0 text-xs text-gray-400">{m.timeLabel}</div>
              </div>
            ))}
            <div className="pt-2">
              <span className="text-sm font-medium text-[#0088CB]">View all messages →</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
            <p className="mt-1 text-sm text-gray-500">{emptySubtitle}</p>
          </div>
        )}
      </div>
    </Link>
  );
}

