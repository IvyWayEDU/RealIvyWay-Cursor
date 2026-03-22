import Link from 'next/link';
import type { PaymentTimelineEvent } from '@/lib/admin/payment-timeline.server';

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function payoutLinkForRef(ref: PaymentTimelineEvent['ref']): string | null {
  if (!ref) return null;
  if (ref.type === 'payout_request' && ref.id) return `/admin/payouts/${ref.id}`;
  return null;
}

export default function PaymentTimeline(props: { events: PaymentTimelineEvent[]; emptyText?: string }) {
  const events = Array.isArray(props.events) ? props.events : [];
  if (events.length === 0) {
    return <div className="text-sm text-gray-600">{props.emptyText || 'No payment events found.'}</div>;
  }

  const dayKeys = events.map((e) => String(e.at || '').slice(0, 10));

  return (
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" aria-hidden />
      <ul className="space-y-5">
        {events.map((e, idx) => {
          const dayKey = dayKeys[idx] || '';
          const prevDayKey = idx > 0 ? dayKeys[idx - 1] || '' : '';
          const showDay = Boolean(dayKey) && dayKey !== prevDayKey;

          const inferred = e?.meta && (e.meta as any)?.allocationsInferred === true;
          const time = formatTime(e.at);
          const payoutHref = payoutLinkForRef(e.ref);

          return (
            <li key={`${e.kind}-${e.at}-${idx}`} className="relative pl-10">
              <span className="absolute left-1.5 top-1.5 h-4 w-4 rounded-full bg-white ring-2 ring-indigo-600" aria-hidden />

              {showDay ? (
                <div className="mb-1 text-xs font-semibold text-gray-500">{formatDay(e.at)}</div>
              ) : null}

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-gray-900">
                      {payoutHref ? (
                        <Link href={payoutHref} className="hover:underline">
                          {e.title}
                        </Link>
                      ) : (
                        e.title
                      )}
                    </div>
                    {inferred ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                        Inferred
                      </span>
                    ) : null}
                  </div>
                  {typeof e.amountCents === 'number' ? (
                    <div className="mt-0.5 text-sm text-gray-700">{money(e.amountCents)}</div>
                  ) : null}
                </div>
                {time ? <div className="shrink-0 text-xs text-gray-500">{time}</div> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

