'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUserDisplayMap } from '@/lib/sessions/useUserDisplayMap';
import { formatUsdFromCents, getSessionPricingCents, Plan as PricingPlan, ServiceType as PricingServiceType } from '@/lib/pricing/catalog';

// Types matching BookingFlowClient
type Service = 'tutoring' | 'counseling' | 'virtual-tour' | 'test-prep' | null;
type Plan = string | null;
type Subject = string | null;
type Topic = string | null;
type School =
  | {
      // Canonical shape (BookingFlowClient)
      id: string;
      name: string;
    }
  | {
      // Legacy shape (older summary versions)
      displayName: string;
      normalizedName: string;
    }
  | null;
type Provider = string | null;

interface SelectedSession {
  date: Date;
  time: string;
  displayString: string;
  // Canonical UTC identity (used by /api/checkout validation/reservation)
  startTimeUTC?: string;
  endTimeUTC?: string;
  providerId?: string | null;
  displayTime?: string;
}

interface BookingState {
  service: Service;
  plan: Plan;
  subject: Subject;
  topic: Topic;
  school: School;
  schoolId?: string | null;
  schoolName?: string | null;
  selectedSessions: SelectedSession[];
  provider: Provider;
}

// Service display names
const SERVICE_NAMES: Record<string, string> = {
  'tutoring': 'Tutoring',
  'test-prep': 'Test Prep',
  'counseling': 'College Counseling',
  'virtual-tour': 'Virtual College Tour',
};

function toPricingParams(service: Service, plan: Plan): {
  service_type: PricingServiceType;
  plan: PricingPlan;
  duration_minutes: 60 | null;
} | null {
  if (!service) return null;

  const svcNorm = String(service).trim().toLowerCase();
  const planNorm = String(plan || '').trim().toLowerCase();

  const service_type: PricingServiceType | null =
    svcNorm === 'tutoring'
      ? 'tutoring'
      : svcNorm === 'test-prep'
        ? 'test_prep'
        : svcNorm === 'virtual-tour'
          ? 'virtual_tour'
          : svcNorm === 'counseling'
            ? 'counseling'
            : null;
  if (!service_type) return null;

  const pricingPlan: PricingPlan =
    planNorm.endsWith('-monthly') || planNorm === 'counseling-monthly' ? 'monthly' : 'single';

  const duration_minutes: 60 | null = service_type === 'counseling' ? 60 : null;

  return { service_type, plan: pricingPlan, duration_minutes };
}

function minutesFromPlan(plan: Plan): number | null {
  if (!plan) return null;
  if (plan === 'counseling-single') return 60;
  if (plan === 'counseling-monthly') return 60;
  // Default for tutoring/test prep/virtual tours (approx)
  return 60;
}

function planDisplayName(service: Service, plan: Plan): string {
  const svc = service || null;
  const p = String(plan || '').trim().toLowerCase();
  if (!svc) return 'Plan';

  if (svc === 'tutoring') return p === 'tutoring-monthly' ? 'Monthly Tutoring Package (4 sessions)' : 'Single Tutoring Session';
  if (svc === 'test-prep') return p === 'test-prep-monthly' ? 'Monthly Test Prep Bundle (4 sessions)' : 'Single Test Prep Session';
  if (svc === 'virtual-tour') return 'Single Virtual College Tour';

  // counseling
  if (p === 'counseling-monthly') return 'Monthly Counseling Plan (4 sessions of 60 min)';
  return 'College Counseling';
}

function sessionLengthDisplay(service: Service, plan: Plan): string {
  if (!service) return '';
  if (service === 'virtual-tour') return 'Live guided tour';
  const m = minutesFromPlan(plan);
  if (!m) return '';
  return '60 minutes';
}

function buildServiceLineItemLabel(service: Service, plan: Plan): string {
  if (!service) return 'Service';

  if (service === 'virtual-tour') {
    // Requirement example: “Virtual Campus Tour”
    return 'Virtual Campus Tour';
  }

  const minutes = minutesFromPlan(plan);
  const minutesSuffix = typeof minutes === 'number' ? ` (${minutes} minutes)` : '';

  switch (service) {
    case 'tutoring':
      return `Tutoring Session${minutesSuffix}`;
    case 'test-prep':
      return `Test Prep Session${minutesSuffix}`;
    case 'counseling':
      return `College Counseling Session${minutesSuffix}`;
    default:
      return 'Service';
  }
}

export default function BookingSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookingState, setBookingState] = useState<BookingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(false);

  // Helper functions
  const getSchoolDisplay = (): string => {
    const direct = typeof (bookingState as any)?.schoolName === 'string' ? String((bookingState as any).schoolName) : '';
    if (direct.trim()) return direct.trim();
    const s = bookingState?.school as any;
    return (s?.name as string) || (s?.displayName as string) || '';
  };
  const getSchoolId = (): string => {
    const direct = typeof (bookingState as any)?.schoolId === 'string' ? String((bookingState as any).schoolId) : '';
    if (direct.trim()) return direct.trim();
    const s = bookingState?.school as any;
    return (s?.id as string) || (s?.normalizedName as string) || '';
  };
  const getPlanInfo = () => {
    const params = toPricingParams(bookingState?.service ?? null, bookingState?.plan ?? null);
    if (!params) return null;
    try {
      return getSessionPricingCents(params);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Check for cancellation parameter
    if (searchParams.get('canceled') === 'true') {
      setCanceled(true);
      // Remove the parameter from URL
      router.replace('/dashboard/book/summary', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    // Load booking state from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ivyway_booking_state');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert date strings back to Date objects
          if (parsed.selectedSessions) {
            parsed.selectedSessions = parsed.selectedSessions.map((session: any) => ({
              ...session,
              date: new Date(session.date),
            }));
          }
          setBookingState(parsed);
        } else {
          // No booking state found, redirect to booking page
          router.push('/dashboard/book');
        }
      } catch (error) {
        console.error('Error loading booking state:', error);
        router.push('/dashboard/book');
      } finally {
        setIsLoading(false);
      }
    }
  }, [router]);

  const handlePay = async () => {
    if (!bookingState) return;

    setIsProcessing(true);
    setError(null);

    try {
      const planInfo = getPlanInfo();
      const pricingKey = typeof (planInfo as any)?.pricing_key === 'string' ? String((planInfo as any).pricing_key).trim() : '';
      const first = bookingState.selectedSessions?.[0];
      const providerId =
        (typeof bookingState.provider === 'string' ? bookingState.provider.trim() : '') ||
        (typeof (first as any)?.providerId === 'string' ? String((first as any).providerId).trim() : '');
      const selectedDate = first?.date instanceof Date ? first.date.toISOString() : '';
      const selectedTime = String((first as any)?.displayTime || (first as any)?.time || '').trim();

      console.log({
        providerId,
        selectedDate,
        selectedTime,
        pricingKey,
      });

      if (!providerId) {
        setError('Provider not loaded. Please refresh.');
        setIsProcessing(false);
        return;
      }
      if (!selectedDate || !selectedTime) {
        setError('Session time not loaded. Please refresh.');
        setIsProcessing(false);
        return;
      }
      if (!pricingKey) {
        setError('Pricing not loaded. Please refresh.');
        setIsProcessing(false);
        return;
      }

      const payloadBookingState = {
        ...bookingState,
        // Ensure schoolId/schoolName are present for counseling booking validation
        schoolId: getSchoolId() || undefined,
        schoolName: getSchoolDisplay() || undefined,
        provider: providerId || null,
        selectedSessions: bookingState.selectedSessions.map((session) => ({
          ...session,
          // Preserve canonical UTC identity for server-side validation/reservation
          startTimeUTC: (session as any).startTimeUTC,
          endTimeUTC: (session as any).endTimeUTC,
          providerId: providerId ?? (session as any).providerId ?? null,
          date: session.date.toISOString(),
          time: (session as any).displayTime || (session as any).time,
        })),
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          sessionDate: selectedDate,
          sessionTime: selectedTime,
          pricingKey,
          bookingState: payloadBookingState,
        }),
      });

      if (!response.ok) {
        const rawBody = await response.text().catch(() => '');
        let jsonBody: any = null;
        try {
          jsonBody = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          jsonBody = null;
        }
        console.error('Checkout API error (full body):', {
          status: response.status,
          statusText: response.statusText,
          rawBody,
          jsonBody,
        });
        throw new Error(jsonBody?.error || jsonBody?.message || rawBody || 'Checkout failed');
      }

      const data = await response.json();

      if (!data.url) throw new Error('No checkout URL received');
      window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Unable to book session. Please try again.');
      setIsProcessing(false);
    }
  };


  const providerId = bookingState?.provider || null;
  const providerIds = useMemo(() => (providerId ? [providerId] : []), [providerId]);
  const { displayNames, status: providerNameStatus } = useUserDisplayMap(providerIds);
  const providerDisplayName =
    providerId && typeof displayNames?.[providerId] === 'string' && displayNames[providerId].trim()
      ? displayNames[providerId].trim()
      : null;

  const getStepForEdit = (section: 'service' | 'plan' | 'datetime') => {
    // Return step number for edit navigation
    switch (section) {
      case 'service':
        return 1;
      case 'plan':
        return 2;
      case 'datetime':
        return 4;
      default:
        return 1;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center text-gray-600">Loading booking summary...</div>
        </div>
      </div>
    );
  }

  if (!bookingState) {
    return null;
  }

  const planInfo = getPlanInfo();
  const serviceName = bookingState.service ? SERVICE_NAMES[bookingState.service] : '';
  const schoolDisplay = getSchoolDisplay();

  // Stripe final charge = service price + Stripe Tax (calculated at Checkout based on address).
  // We can show the service price now; tax/total will be shown on Stripe Checkout + confirmation.
  const baseCents = planInfo ? planInfo.purchase_price_cents : 0;

  // Display-only breakdown rules:
  // - Before Stripe tax is available, show Total = base service price (avoid "calculated at checkout" for Total).
  // - Stripe will show final tax/total on Checkout itself, and we show the tax breakdown on the success/receipt page.
  const taxAmountCents: number | null = null;
  const totalDisplayCents = typeof taxAmountCents === 'number' ? baseCents + taxAmountCents : baseCents;

  return (
    <div className="min-h-screen w-full bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review your booking details and complete your purchase
          </p>
        </div>

        {/* Booking Details Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
          </div>

          {/* Service */}
          <div className="flex items-start justify-between py-3 border-b border-gray-100">
            <div className="flex-1">
              <div className="text-sm text-gray-500 mb-1">Service Type</div>
              <div className="text-base font-medium text-gray-900">{serviceName}</div>
            </div>
            <Link
              href={`/dashboard/book?step=${getStepForEdit('service')}`}
              className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
            >
              Edit
            </Link>
          </div>

          {/* Plan */}
          {planInfo && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">Plan</div>
                <div className="text-base font-medium text-gray-900">
                  {planDisplayName(bookingState.service, bookingState.plan)}
                </div>
              </div>
              <Link
                href={`/dashboard/book?step=${getStepForEdit('plan')}`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}

          {/* Subject or School */}
          {(bookingState.subject || bookingState.school) && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">
                  {bookingState.service === 'tutoring' || bookingState.service === 'test-prep'
                    ? 'Subject'
                    : 'School'}
                </div>
                <div className="text-base font-medium text-gray-900">
                  {bookingState.subject || schoolDisplay}
                </div>
                {bookingState.topic && (
                  <div className="text-sm text-gray-600 mt-1">
                    Topic: {bookingState.topic}
                  </div>
                )}
              </div>
              <Link
                href={`/dashboard/book?step=3`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}

          {/* Session Length */}
          {planInfo && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">Session Length</div>
                <div className="text-base font-medium text-gray-900">
                  {sessionLengthDisplay(bookingState.service, bookingState.plan)}
                </div>
              </div>
            </div>
          )}

          {/* Number of Sessions */}
          {bookingState.selectedSessions.length > 0 && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">Number of Sessions</div>
                <div className="text-base font-medium text-gray-900">
                  {bookingState.selectedSessions.length} session{bookingState.selectedSessions.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {/* Selected Dates & Times */}
          {bookingState.selectedSessions.length > 0 && (
            <div className="flex items-start justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-2">Selected Date(s) and Time(s)</div>
                <div className="space-y-2">
                  {bookingState.selectedSessions.map((session, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-md"
                    >
                      <svg className="w-5 h-5 text-[#0088CB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{session.displayString}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href={`/dashboard/book?step=${getStepForEdit('datetime')}`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}

          {/* Provider */}
          {providerId && (
            <div className="flex items-start justify-between py-3">
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">
                  {bookingState.service === 'tutoring' || bookingState.service === 'test-prep'
                    ? 'Selected Tutor'
                    : 'Selected Counselor'}
                </div>
                <div className="mt-2">
                  <div className="text-base font-medium text-gray-900">
                    {providerNameStatus === 'loading' ? 'Loading provider…' : providerDisplayName || 'Provider'}
                  </div>
                </div>
              </div>
              <Link
                href={`/dashboard/book?step=5`}
                className="text-sm text-[#0088CB] hover:text-[#0077B3] font-medium"
              >
                Edit
              </Link>
            </div>
          )}
        </div>

        {/* Order Summary Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-medium text-gray-900">Service price</div>
                <div className="text-base font-medium text-gray-900">{formatUsdFromCents(baseCents)}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-base text-gray-700">Tax</div>
                <div className="text-base text-gray-700">
                  {typeof taxAmountCents === 'number' ? formatUsdFromCents(taxAmountCents) : 'Calculated at checkout'}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900">Total</div>
                <div className="text-2xl font-bold text-[#0088CB]">{formatUsdFromCents(totalDisplayCents)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {canceled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-900">Payment Canceled</p>
                  <p className="text-sm text-amber-700 mt-1">Your booking was not completed. You can try again below.</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full px-8 py-3 bg-[#0088CB] text-white font-semibold rounded-md hover:bg-[#0077B3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing
              ? 'Processing...'
              : `Continue to secure checkout (${formatUsdFromCents(baseCents)} + tax)`}
          </button>
        </div>

        {/* Back Button */}
        <div className="flex items-center justify-start gap-4">
          <Link
            href="/dashboard/book"
            className="px-6 py-2.5 font-medium rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Back to Booking
          </Link>
        </div>
      </div>
    </div>
  );
}
