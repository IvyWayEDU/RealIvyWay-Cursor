import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

type StoredSessionTime = { scheduledStart: string; scheduledEnd: string };

export type CheckoutBookingRecord = {
  id: string;
  createdAt: string;
  studentId: string;
  providerId: string;
  serviceType: string;
  plan: 'single' | 'monthly' | 'yearly';
  sessionTimes: StoredSessionTime[];
  // Booking context (stored server-side; Stripe metadata is size-limited)
  subject?: string | null;
  topic?: string | null;
  schoolId?: string | null;
  schoolName?: string | null;
};

type CheckoutBookingStorage = Record<string, CheckoutBookingRecord>;

function toIsoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export async function writeCheckoutBookingRecord(record: CheckoutBookingRecord): Promise<void> {
  if (!record?.id) throw new Error('Missing checkout booking id');
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('bookings').upsert(
    {
      id: record.id,
      checkout_session_id: null,
      data: record,
      created_at: record.createdAt || new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function readCheckoutBookingRecord(id: string): Promise<CheckoutBookingRecord | null> {
  if (!id) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('bookings').select('data').eq('id', id).maybeSingle();
  if (error) throw error;
  const found = (data as any)?.data as CheckoutBookingRecord | undefined;
  if (!found) return null;
  // Normalize defensively
  const sessionTimes: StoredSessionTime[] = Array.isArray(found.sessionTimes)
    ? found.sessionTimes
        .map((t: any) => {
          const s = toIsoOrNull(t?.scheduledStart);
          const e = toIsoOrNull(t?.scheduledEnd);
          if (!s || !e) return null;
          const sMs = new Date(s).getTime();
          const eMs = new Date(e).getTime();
          if (!Number.isFinite(sMs) || !Number.isFinite(eMs) || eMs <= sMs) return null;
          return { scheduledStart: s, scheduledEnd: e };
        })
        .filter((t): t is StoredSessionTime => Boolean(t))
    : [];
  return {
    id: String(found.id),
    createdAt: typeof found.createdAt === 'string' ? found.createdAt : new Date().toISOString(),
    studentId: typeof found.studentId === 'string' ? found.studentId : '',
    providerId: typeof found.providerId === 'string' ? found.providerId : '',
    serviceType: typeof found.serviceType === 'string' ? found.serviceType : '',
    plan: found.plan === 'monthly' || found.plan === 'yearly' ? found.plan : 'single',
    sessionTimes,
    subject: typeof (found as any)?.subject === 'string' && String((found as any).subject).trim() ? String((found as any).subject).trim() : null,
    topic: typeof (found as any)?.topic === 'string' && String((found as any).topic).trim() ? String((found as any).topic).trim() : null,
    schoolId:
      typeof (found as any)?.schoolId === 'string' && String((found as any).schoolId).trim()
        ? String((found as any).schoolId).trim()
        : null,
    schoolName:
      typeof (found as any)?.schoolName === 'string' && String((found as any).schoolName).trim()
        ? String((found as any).schoolName).trim()
        : null,
  };
}

export async function deleteCheckoutBookingRecord(id: string): Promise<void> {
  if (!id) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) throw error;
}

export async function setCheckoutBookingCheckoutSessionId(bookingId: string, checkoutSessionId: string): Promise<void> {
  const bid = String(bookingId || '').trim();
  const sid = String(checkoutSessionId || '').trim();
  if (!bid || !sid) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('bookings').update({ checkout_session_id: sid }).eq('id', bid);
  if (error) throw error;
}


