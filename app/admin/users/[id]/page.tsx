import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getUserById, getUsers } from '@/lib/auth/storage';
import { getSessions } from '@/lib/sessions/storage';
import { calculateProviderPayoutCentsFromSession } from '@/lib/earnings/calc';
import { getReviewsByProviderId } from '@/lib/reviews/storage.server';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) return notFound();

  const [sessions, allUsers, reviews] = await Promise.all([
    getSessions(),
    getUsers(),
    getReviewsByProviderId(id),
  ]);

  const related = (sessions as any[]).filter((s) => s?.studentId === user.id || s?.providerId === user.id);
  const providerSessions = (sessions as any[]).filter((s) => s?.providerId === user.id);

  const roles: string[] = Array.isArray((user as any)?.roles) ? (user as any).roles : [];
  const isProvider = roles.includes('provider') || roles.includes('tutor') || roles.includes('counselor');

  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
  }

  function accountAgeLabel(iso: string | null | undefined): string {
    if (!iso) return '—';
    const created = new Date(iso);
    const createdMs = created.getTime();
    if (!Number.isFinite(createdMs)) return '—';
    const nowMs = Date.now();
    const diffDays = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24)));
    if (diffDays < 14) return `Active for ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    const diffMonths = Math.max(0, Math.floor(diffDays / 30));
    if (diffMonths < 24) return `Active for ${diffMonths} month${diffMonths === 1 ? '' : 's'}`;
    const diffYears = Math.max(0, Math.floor(diffMonths / 12));
    return `Active for ${diffYears} year${diffYears === 1 ? '' : 's'}`;
  }

  function providerRoleLabel(u: any): string {
    const r: string[] = Array.isArray(u?.roles) ? u.roles : [];
    const servicesRaw: unknown = u?.services ?? u?.serviceTypes ?? u?.profile?.serviceTypes ?? u?.profile?.services;
    const services: string[] = Array.isArray(servicesRaw) ? servicesRaw.map((s) => String(s || '').trim()).filter(Boolean) : [];

    const isTutor =
      r.includes('tutor') ||
      u?.isTutor === true ||
      services.includes('tutoring') ||
      services.includes('test_prep') ||
      services.includes('test-prep');
    const isCounselor =
      r.includes('counselor') ||
      u?.isCounselor === true ||
      services.includes('college_counseling') ||
      services.includes('counseling') ||
      services.includes('virtual_tour') ||
      services.includes('virtual-tour');

    if (isTutor && isCounselor) return 'Tutor + Counselor';
    if (isTutor) return 'Tutor';
    if (isCounselor) return 'Counselor';
    return isProvider ? 'Provider' : '—';
  }

  const completedProviderSessions = providerSessions.filter((s) => String(s?.status || '') === 'completed');
  const cancelledProviderSessions = providerSessions.filter((s) => {
    const st = String(s?.status || '');
    return st === 'cancelled' || st === 'cancelled-late' || st === 'refunded';
  });
  const noShowProviderSessions = providerSessions.filter((s) => {
    const st = String(s?.status || '');
    return (
      st === 'flagged' ||
      st === 'no-show' ||
      st === 'no_show_student' ||
      st === 'no_show_provider' ||
      st === 'no_show_both' ||
      st === 'student_no_show' ||
      st === 'provider_no_show' ||
      st === 'expired_provider_no_show'
    );
  });

  const totalLifetimeEarningsCents = completedProviderSessions.reduce(
    (sum, s) => sum + calculateProviderPayoutCentsFromSession(s as any),
    0
  );
  const totalWithdrawnCents = completedProviderSessions
    .filter((s) => {
      const ps = String((s as any)?.payoutStatus || 'available');
      return ps === 'paid' || ps === 'paid_out';
    })
    .reduce((sum, s) => sum + calculateProviderPayoutCentsFromSession(s as any), 0);
  const availableBalanceCents = Math.max(0, totalLifetimeEarningsCents - totalWithdrawnCents);

  function money(cents: number): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
  }

  const userById = new Map<string, any>();
  for (const u of Array.isArray(allUsers) ? (allUsers as any[]) : []) userById.set(String(u?.id || ''), u);

  const providerReviews = Array.isArray(reviews) ? reviews : [];
  const providerReviewCount = providerReviews.length;
  const providerAverageRating =
    providerReviewCount === 0
      ? 0
      : providerReviews.reduce((sum: number, r: any) => sum + Number(r?.rating || 0), 0) / providerReviewCount;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User</h1>
          <p className="mt-1 text-sm text-gray-600 font-mono break-all">{user.id}</p>
        </div>
        <Link href="/admin/users" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Back to Users
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200 lg:col-span-1 space-y-5">
          <div>
            <div className="text-sm font-semibold text-gray-900">Account Info</div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Full Name</dt>
                <dd className="text-gray-900">{user.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">{user.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Role</dt>
                <dd className="text-gray-900">{providerRoleLabel(user as any)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Account Created Date</dt>
                <dd className="text-gray-900">{fmtDate((user as any)?.accountCreatedAt || (user as any)?.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Account Age</dt>
                <dd className="text-gray-900">{accountAgeLabel((user as any)?.accountCreatedAt || (user as any)?.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Roles (raw)</dt>
                <dd className="text-gray-900">
                  {Array.isArray((user as any).roles) ? (user as any).roles.join(', ') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-900">{(user as any).status || 'active'}</dd>
              </div>
            </dl>
          </div>

          {isProvider ? (
            <div>
              <div className="text-sm font-semibold text-gray-900">Session Stats</div>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md border border-gray-200 p-3">
                  <dt className="text-gray-500">Total completed</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">{completedProviderSessions.length}</dd>
                </div>
                <div className="rounded-md border border-gray-200 p-3">
                  <dt className="text-gray-500">Total canceled</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">{cancelledProviderSessions.length}</dd>
                </div>
                <div className="rounded-md border border-gray-200 p-3 col-span-2">
                  <dt className="text-gray-500">No-shows</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">{noShowProviderSessions.length}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {isProvider ? (
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <div className="text-sm font-semibold text-gray-900">Financials</div>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
                <div className="rounded-md border border-gray-200 p-3">
                  <dt className="text-gray-500">Total lifetime earnings</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">{money(totalLifetimeEarningsCents)}</dd>
                </div>
                <div className="rounded-md border border-gray-200 p-3">
                  <dt className="text-gray-500">Total withdrawn</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">{money(totalWithdrawnCents)}</dd>
                </div>
                <div className="rounded-md border border-gray-200 p-3">
                  <dt className="text-gray-500">Current available balance</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">{money(availableBalanceCents)}</dd>
                </div>
              </dl>
              <div className="mt-3 text-xs text-gray-500">
                Withdrawn is derived from sessions marked <span className="font-mono">payoutStatus=paid/paid_out</span>.
              </div>
            </div>
          ) : null}

          {isProvider ? (
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-gray-900">Reviews</div>
                <div className="text-sm text-gray-500">{providerReviewCount}</div>
              </div>
              <div className="mt-3 text-sm text-gray-700">
                Average rating:{' '}
                <span className="font-semibold text-gray-900">
                  {providerReviewCount ? providerAverageRating.toFixed(2) : '—'}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {providerReviews.slice(0, 25).map((r: any) => {
                  const reviewerId = String(r?.reviewerId || r?.studentId || '');
                  const reviewer = reviewerId ? userById.get(reviewerId) : null;
                  const reviewerName = (reviewer as any)?.name || reviewerId || 'Unknown';
                  const rating = Number(r?.rating || 0);
                  const comment = String(r?.reviewText || '').trim();
                  return (
                    <div key={String(r?.sessionId || '') + ':' + reviewerId} className="rounded-md border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{reviewerName}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            Rating: <span className="font-semibold">{Number.isFinite(rating) ? rating : '—'}</span> •{' '}
                            {fmtDate(r?.submittedAt)}
                          </div>
                        </div>
                        {r?.sessionId ? (
                          <Link
                            href={`/admin/sessions/${encodeURIComponent(String(r.sessionId))}`}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                          >
                            View session
                          </Link>
                        ) : null}
                      </div>
                      {comment ? <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{comment}</div> : null}
                    </div>
                  );
                })}
                {providerReviews.length === 0 && <div className="text-sm text-gray-600">No reviews found for this provider.</div>}
                {providerReviews.length > 25 && <div className="text-xs text-gray-500">Showing first 25.</div>}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Sessions</div>
              <div className="text-sm text-gray-500">{related.length}</div>
            </div>
            <div className="mt-4 space-y-2">
              {related.slice(0, 20).map((s) => (
                <div key={s.id} className="rounded-md border border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{s.id}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {s.studentName || s.studentId} → {s.providerName || s.providerId}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {s.scheduledStartTime} — {s.scheduledEndTime} • {String(s.status || 'unknown')}
                      </div>
                    </div>
                    <Link
                      href={`/admin/sessions/${encodeURIComponent(s.id)}`}
                      className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {related.length === 0 && <div className="text-sm text-gray-600">No sessions found for this user.</div>}
              {related.length > 20 && <div className="text-xs text-gray-500">Showing first 20.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


