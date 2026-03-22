import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getPayoutRequestById, updatePayoutRequestSnapshot } from '@/lib/payouts/payout-requests.server';
import { getProviderByUserId } from '@/lib/providers/storage';
import { getUserById } from '@/lib/auth/storage';
import { buildPayoutRequestSnapshot, normalizePayoutMethod } from '@/lib/payouts/payout-snapshot';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

function payoutMethodLabel(method: ReturnType<typeof normalizePayoutMethod>): string | undefined {
  if (!method) return undefined;
  if (method === 'wise') return 'Wise';
  if (method === 'paypal') return 'PayPal';
  if (method === 'zelle') return 'Zelle';
  if (method === 'bank') return 'Bank Transfer';
  if (method === 'stripe') return 'Stripe';
  return undefined;
}

function extractSnapshotDestinationEmailOrContact(args: {
  payoutMethod: ReturnType<typeof normalizePayoutMethod>;
  payoutDestination?: unknown;
}): string | undefined {
  if (args.payoutMethod === 'wise' || args.payoutMethod === 'paypal' || args.payoutMethod === 'zelle') {
    const d = typeof args.payoutDestination === 'string' ? args.payoutDestination.trim() : '';
    return d || undefined;
  }
  return undefined;
}

function cleanString(value: unknown): string | undefined {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? v : undefined;
}

export async function GET(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const payoutRequestId = String(request.nextUrl.searchParams.get('payoutRequestId') ?? '').trim();
    if (!payoutRequestId) {
      return NextResponse.json({ error: 'payoutRequestId is required' }, { status: 400 });
    }

    let pr = await getPayoutRequestById(payoutRequestId);
    if (!pr) return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });

    const providerId = String(pr.providerId || '').trim();
    const [providerUser, providerProfile] = await Promise.all([
      providerId ? getUserById(providerId) : Promise.resolve(null),
      providerId ? getProviderByUserId(providerId) : Promise.resolve(null),
    ]);

    const methodFromRequest = normalizePayoutMethod(pr.payoutMethod);
    const methodFromProfile = normalizePayoutMethod((providerProfile as any)?.payoutMethod);
    const payoutMethod = methodFromRequest || methodFromProfile;

    const snapshotDestinationLegacy = extractSnapshotDestinationEmailOrContact({
      payoutMethod,
      payoutDestination: pr.payoutDestination,
    });

    // Snapshot-first resolution (request snapshot fields, then provider profile fields, then legacy destination fallback).
    const wiseEmail =
      payoutMethod === 'wise'
        ? cleanString(pr.wiseEmail) || cleanString((providerProfile as any)?.wiseEmail) || snapshotDestinationLegacy
        : undefined;
    const paypalEmail =
      payoutMethod === 'paypal'
        ? cleanString(pr.paypalEmail) || cleanString((providerProfile as any)?.paypalEmail) || snapshotDestinationLegacy
        : undefined;
    const zelleContact =
      payoutMethod === 'zelle'
        ? cleanString(pr.zelleContact) || cleanString((providerProfile as any)?.zelleContact) || snapshotDestinationLegacy
        : undefined;

    const bankName =
      payoutMethod === 'bank'
        ? cleanString(pr.bankName) || cleanString((providerProfile as any)?.bankName)
        : undefined;
    const bankCountry =
      payoutMethod === 'bank'
        ? cleanString(pr.bankCountry) || cleanString((providerProfile as any)?.bankCountry)
        : undefined;
    const bankAccountNumber =
      payoutMethod === 'bank'
        ? cleanString(pr.bankAccountNumber) || cleanString((providerProfile as any)?.bankAccountNumber)
        : undefined;
    const bankRoutingNumber =
      payoutMethod === 'bank'
        ? cleanString(pr.bankRoutingNumber) || cleanString((providerProfile as any)?.bankRoutingNumber)
        : undefined;
    const accountHolderNameRaw =
      payoutMethod === 'bank'
        ? (pr.accountHolderName ??
            (providerProfile as any)?.accountHolderName ??
            (providerProfile as any)?.bankAccountHolderName ??
            (providerProfile as any)?.account_holder_name)
        : undefined;
    const accountHolderName = cleanString(accountHolderNameRaw);

    // Fallback "migration" on load:
    // If the payout request is missing snapshot fields but the provider profile has payout details,
    // populate the missing snapshot so the modal always shows the original destination.
    const createdAtMs = Date.parse(String(pr.createdAt || ''));
    const isRecent = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs < 1000 * 60 * 60 * 24 * 45 : true;
    const snapshotMissing =
      !cleanString(pr.payoutMethod) ||
      !cleanString(pr.payoutDestinationMasked) ||
      (payoutMethod === 'bank' &&
        (!cleanString(pr.bankName) || !cleanString(pr.bankAccountNumber) || !cleanString(pr.bankRoutingNumber) || !cleanString(pr.bankCountry))) ||
      (payoutMethod === 'wise' && !cleanString(pr.wiseEmail)) ||
      (payoutMethod === 'paypal' && !cleanString(pr.paypalEmail)) ||
      (payoutMethod === 'zelle' && !cleanString(pr.zelleContact));

    if (isRecent && snapshotMissing && providerProfile) {
      const snapshot = buildPayoutRequestSnapshot({ provider: providerProfile, bankMeta: null });
      const shouldWrite =
        cleanString(snapshot.payoutMethod) &&
        (cleanString(snapshot.payoutDestinationMasked) ||
          cleanString(snapshot.bankAccountNumber) ||
          cleanString(snapshot.bankRoutingNumber) ||
          cleanString(snapshot.wiseEmail) ||
          cleanString(snapshot.paypalEmail) ||
          cleanString(snapshot.zelleContact));

      if (shouldWrite) {
        const patched = await updatePayoutRequestSnapshot(pr.id, {
          payoutMethod: cleanString(pr.payoutMethod) ? pr.payoutMethod : snapshot.payoutMethod,
          payoutDestinationMasked: cleanString(pr.payoutDestinationMasked) ? pr.payoutDestinationMasked : snapshot.payoutDestinationMasked,
          // Keep legacy destination populated for older code paths.
          payoutDestination: cleanString(pr.payoutDestination) ? pr.payoutDestination : snapshot.payoutDestinationMasked,
          bankName: cleanString(pr.bankName) ? pr.bankName : snapshot.bankName,
          bankCountry: cleanString(pr.bankCountry) ? pr.bankCountry : snapshot.bankCountry,
          bankAccountNumber: cleanString(pr.bankAccountNumber) ? pr.bankAccountNumber : snapshot.bankAccountNumber,
          bankRoutingNumber: cleanString(pr.bankRoutingNumber) ? pr.bankRoutingNumber : snapshot.bankRoutingNumber,
          accountHolderName: cleanString(pr.accountHolderName) ? pr.accountHolderName : snapshot.accountHolderName,
          wiseEmail: cleanString(pr.wiseEmail) ? pr.wiseEmail : snapshot.wiseEmail,
          paypalEmail: cleanString(pr.paypalEmail) ? pr.paypalEmail : snapshot.paypalEmail,
          zelleContact: cleanString(pr.zelleContact) ? pr.zelleContact : snapshot.zelleContact,
        });
        if (patched) pr = patched;
      }
    }

    return NextResponse.json(
      {
        success: true,
        payoutRequest: pr,
        provider: {
          id: providerId,
          name: providerUser?.name || providerUser?.email || providerId,
          email: providerUser?.email || '',
        },
        // Included for temporary modal debug logs.
        providerPayoutProfile: {
          payoutMethod: cleanString((providerProfile as any)?.payoutMethod),
          wiseEmail: cleanString((providerProfile as any)?.wiseEmail),
          paypalEmail: cleanString((providerProfile as any)?.paypalEmail),
          zelleContact: cleanString((providerProfile as any)?.zelleContact),
          bankName: cleanString((providerProfile as any)?.bankName),
          bankCountry: cleanString((providerProfile as any)?.bankCountry),
          bankAccountNumber: cleanString((providerProfile as any)?.bankAccountNumber),
          bankRoutingNumber: cleanString((providerProfile as any)?.bankRoutingNumber),
          accountHolderName:
            cleanString((providerProfile as any)?.accountHolderName) ||
            cleanString((providerProfile as any)?.bankAccountHolderName) ||
            cleanString((providerProfile as any)?.account_holder_name),
        },
        payoutMethod: payoutMethodLabel(payoutMethod) || pr.payoutMethod,
        payoutDetails: {
          payoutMethod: payoutMethodLabel(payoutMethod) || pr.payoutMethod,
          wiseEmail,
          paypalEmail,
          zelleContact,
          bankName,
          bankCountry,
          bankAccountNumber,
          bankRoutingNumber,
          accountHolderName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/payout-requests/details]' });
  }
}

