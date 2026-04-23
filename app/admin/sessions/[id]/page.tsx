import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionById } from '@/lib/sessions/storage';
import { getAdminSessionPaymentTimeline } from '@/lib/admin/payment-timeline.server';
import PaymentTimeline from '@/components/admin/PaymentTimeline';
import { getUserById } from '@/lib/auth/storage';
import { getProviderByUserId } from '@/lib/providers/storage';
import { calculateProviderPayoutCentsFromSession, getSessionGrossCents } from '@/lib/earnings/calc';
import AdminSessionNotesClient from '@/components/admin/AdminSessionNotesClient';

export const runtime = 'nodejs';

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function formatMoneyFromCents(cents: number): string {
  const c = Number.isFinite(cents) ? Math.max(0, Math.floor(cents)) : 0;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(c / 100);
}

function rolesLabelFromUser(user: any | null): string {
  const roles: string[] = Array.isArray(user?.roles) ? user.roles.map((r: any) => String(r ?? '').trim()).filter(Boolean) : [];
  if (roles.length === 0) return '—';
  return roles.join(', ');
}

function accountRolePrimaryFromUser(user: any | null): string {
  const roles: string[] = Array.isArray(user?.roles) ? user.roles.map((r: any) => String(r ?? '').trim().toLowerCase()).filter(Boolean) : [];
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('student')) return 'student';
  if (roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor')) return 'provider';
  return roles[0] || '—';
}

type StripeRefundRow = {
  id: string;
  amountCents: number;
  currency: string | null;
  status: string | null;
  reason: string | null;
  createdAt: string | null;
};

async function getStripeRefundsForPaymentIntent(paymentIntentId: string): Promise<StripeRefundRow[] | null> {
  const pi = cleanString(paymentIntentId);
  if (!pi) return null;
  const secretKey = cleanString(process.env.STRIPE_SECRET_KEY);
  if (!secretKey) return null;

  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
    const intent = await stripe.paymentIntents.retrieve(pi, { expand: ['charges.data.refunds'] });

    const refunds: StripeRefundRow[] = [];
    const charges: any[] = Array.isArray((intent as any)?.charges?.data) ? (intent as any).charges.data : [];
    for (const c of charges) {
      const rs: any[] = Array.isArray(c?.refunds?.data) ? c.refunds.data : [];
      for (const r of rs) {
        const created = typeof r?.created === 'number' ? new Date(r.created * 1000).toISOString() : null;
        refunds.push({
          id: String(r?.id || ''),
          amountCents: Number.isFinite(Number(r?.amount)) ? Math.max(0, Math.floor(Number(r.amount))) : 0,
          currency: typeof r?.currency === 'string' ? r.currency : null,
          status: typeof r?.status === 'string' ? r.status : null,
          reason: typeof r?.reason === 'string' ? r.reason : null,
          createdAt: created,
        });
      }
    }

    refunds.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return refunds;
  } catch {
    return null;
  }
}

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) return notFound();

  const s: any = session as any;
  const timeline = await getAdminSessionPaymentTimeline(String(s.id || id));
  const [studentUser, providerUser, providerProfile, stripeRefunds] = await Promise.all([
    s?.studentId ? getUserById(String(s.studentId)) : Promise.resolve(null),
    s?.providerId ? getUserById(String(s.providerId)) : Promise.resolve(null),
    s?.providerId ? getProviderByUserId(String(s.providerId)) : Promise.resolve(null),
    s?.stripePaymentIntentId ? getStripeRefundsForPaymentIntent(String(s.stripePaymentIntentId)) : Promise.resolve(null),
  ]);

  const providerPayoutCents = calculateProviderPayoutCentsFromSession(session as any);
  const grossCents = Math.max(0, getSessionGrossCents(session as any));
  const platformFeeCents = Math.max(0, Math.floor(grossCents - providerPayoutCents));

  const amountRefundedCents = Number.isFinite(Number(s?.amountRefundedCents)) ? Math.max(0, Math.floor(Number(s.amountRefundedCents))) : 0;
  const amountChargedCents = Number.isFinite(Number(s?.amountChargedCents)) ? Math.max(0, Math.floor(Number(s.amountChargedCents))) : 0;
  const totalChargeCents = Number.isFinite(Number(s?.total_charge_cents)) ? Math.max(0, Math.floor(Number(s.total_charge_cents))) : 0;
  const effectiveChargedCents = totalChargeCents || amountChargedCents || grossCents;
  const netPaidCents = Math.max(0, effectiveChargedCents - amountRefundedCents);

  const refundStatus =
    amountRefundedCents > 0 ? (amountRefundedCents >= effectiveChargedCents ? 'fully_refunded' : 'partially_refunded') : 'not_refunded';

  const paymentStatus = s?.isPaid === true ? 'paid' : 'unpaid';
  const zoomJoinUrl = cleanString(s?.zoom_join_url) || cleanString(s?.joinUrl) || cleanString(s?.zoom_url) || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session Detail</h1>
          <div className="mt-1 text-sm text-gray-600 font-mono break-all">{s.id}</div>
        </div>
        <Link
          href="/admin/sessions"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to Sessions
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Status section (button lives here per requirements) */}
        <div className="bg-white shadow rounded-lg overflow-hidden lg:col-span-1">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Status</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Current Status</div>
              <div className="text-base font-semibold text-gray-900">{String(s.status || 'unknown')}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Admin review</div>
              <div className="text-sm text-gray-900">
                {s?.requiresAdminReview === true || String(s?.status || '') === 'provider_no_show' ? 'Required' : '—'}
              </div>
            </div>
            <div className="pt-2">
              <Link
                href="#payment-timeline"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                View Payment Timeline
              </Link>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white shadow rounded-lg overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Student</div>
                <div className="mt-1 text-sm text-gray-900">{(studentUser as any)?.name || s.studentName || s.studentId}</div>
                <div className="mt-1 text-xs text-gray-600 font-mono break-all">User ID: {String(s.studentId || '—')}</div>
                <div className="mt-1 text-xs text-gray-600">Email: {(studentUser as any)?.email || '—'}</div>
                <div className="mt-1 text-xs text-gray-600">Account role: {accountRolePrimaryFromUser(studentUser as any)}</div>
                <div className="mt-1 text-xs text-gray-500">Roles (raw): {rolesLabelFromUser(studentUser as any)}</div>
                <div className="mt-1 text-xs text-gray-600 font-mono break-all">
                  Stripe customer: {cleanString((studentUser as any)?.stripeCustomerId) || '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Provider</div>
                <div className="mt-1 text-sm text-gray-900">{(providerUser as any)?.name || s.providerName || s.providerId}</div>
                <div className="mt-1 text-xs text-gray-600 font-mono break-all">User ID: {String(s.providerId || '—')}</div>
                <div className="mt-1 text-xs text-gray-600">Email: {(providerUser as any)?.email || '—'}</div>
                <div className="mt-1 text-xs text-gray-600">Account role: {accountRolePrimaryFromUser(providerUser as any)}</div>
                <div className="mt-1 text-xs text-gray-500">Roles (raw): {rolesLabelFromUser(providerUser as any)}</div>
                <div className="mt-1 text-xs text-gray-600 font-mono break-all">
                  Provider profile ID: {providerProfile ? String((providerProfile as any)?.id || s.providerId || '—') : '—'}
                </div>
                <div className="mt-1 text-xs text-gray-600 font-mono break-all">
                  Stripe Connect acct: {providerProfile ? cleanString((providerProfile as any)?.stripeConnectAccountId) || '—' : '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Service</div>
                <div className="mt-1 text-sm text-gray-900">{s.serviceType || s.service_type || s.serviceTypeId || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Subject / Topic</div>
                <div className="mt-1 text-sm text-gray-900">
                  {(() => {
                    const subject =
                      typeof s.subject === 'string' && s.subject.trim() ? s.subject.trim() : '';
                    const topic =
                      typeof s.topic === 'string' && s.topic.trim() ? s.topic.trim() : '';
                    if (subject && topic) return `${subject} — ${topic}`;
                    return subject || topic || '—';
                  })()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Scheduled Start</div>
                <div className="mt-1 text-sm text-gray-900">{s.scheduledStartTime}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Scheduled End</div>
                <div className="mt-1 text-sm text-gray-900">{s.scheduledEndTime}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Zoom meeting</div>
                <div className="mt-1 text-sm text-gray-900 font-mono break-all">{cleanString(s.zoomMeetingId) || '—'}</div>
                <div className="mt-1 text-xs text-gray-600 break-all">
                  Join link:{' '}
                  {zoomJoinUrl ? (
                    <a className="text-indigo-600 hover:text-indigo-700 underline" href={zoomJoinUrl} target="_blank" rel="noreferrer">
                      {zoomJoinUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Stripe references</div>
                <div className="mt-1 text-xs text-gray-600 font-mono break-all">PaymentIntent: {cleanString(s.stripePaymentIntentId) || '—'}</div>
                <div className="mt-1 text-xs text-gray-600 font-mono break-all">Checkout session: {cleanString(s.stripeCheckoutSessionId) || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Completed At</div>
                <div className="mt-1 text-sm text-gray-900">{s.completedAt || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Completion Reason</div>
                <div className="mt-1 text-sm text-gray-900">{s.completionReason || '—'}</div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">Payment / Refund / Payout</h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Payment status</div>
                  <div className="mt-1 text-sm text-gray-900">{paymentStatus}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Refund status</div>
                  <div className="mt-1 text-sm text-gray-900">{refundStatus}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Net paid (after refunds)</div>
                  <div className="mt-1 text-sm text-gray-900">{formatMoneyFromCents(netPaidCents)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Refunded</div>
                  <div className="mt-1 text-sm text-gray-900">{formatMoneyFromCents(amountRefundedCents)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Provider payout (computed)</div>
                  <div className="mt-1 text-sm text-gray-900">{formatMoneyFromCents(providerPayoutCents)}</div>
                  <div className="mt-1 text-xs text-gray-500 font-mono">providerPayoutCents={providerPayoutCents}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Platform fee (computed)</div>
                  <div className="mt-1 text-sm text-gray-900">{formatMoneyFromCents(platformFeeCents)}</div>
                  <div className="mt-1 text-xs text-gray-500 font-mono">platformFeeCents={platformFeeCents}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Payout status</div>
                  <div className="mt-1 text-sm text-gray-900">{String(s.payoutStatus ?? '—')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Payout eligibility</div>
                  <div className="mt-1 text-sm text-gray-900">
                    {(s?.providerEligibleForPayout === true || s?.providerEarned === true) ? 'eligible' : 'not eligible'}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">Refund history (Stripe)</h3>
              <div className="mt-3 space-y-2">
                {stripeRefunds && stripeRefunds.length > 0 ? (
                  stripeRefunds.map((r) => (
                    <div key={r.id} className="rounded-md border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 font-mono break-all">{r.id}</div>
                          <div className="mt-1 text-xs text-gray-600">
                            {r.createdAt || '—'} • {r.status || '—'} • {r.reason || '—'}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatMoneyFromCents(r.amountCents)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-600">
                    {s?.stripePaymentIntentId ? 'No Stripe refunds found (or Stripe is not configured).' : 'No Stripe payment intent on this session.'}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <AdminSessionNotesClient sessionId={String(s.id || id)} initialNotes={String(s.adminNotes || '')} />
            </div>
          </div>
        </div>
      </div>

      <div id="payment-timeline" className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Payment Timeline</h2>
          {timeline.payoutRequestIds.length ? (
            <div className="text-xs text-gray-500">
              Linked payout records: {timeline.payoutRequestIds.length}
            </div>
          ) : null}
        </div>
        <div className="p-6">
          <PaymentTimeline events={timeline.events} emptyText="No financial events found for this session yet." />
        </div>
      </div>
    </div>
  );
}



