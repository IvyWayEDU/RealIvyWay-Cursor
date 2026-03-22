import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { getProviderByUserId, updateProviderPayoutDetailsByUserId } from '@/lib/providers/storage';
import { validateRequestBody } from '@/lib/validation/utils';
import { providerPayoutDetailsSchema } from '@/lib/validation/schemas';
import { handleApiError } from '@/lib/errorHandler';

export const runtime = 'nodejs';

function last4(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length < 4) return null;
  return v.slice(-4);
}

function toResponsePayload(provider: any) {
  const bankAccountLast4 = last4(provider?.bankAccountNumber);
  const bankRoutingLast4 = last4(provider?.bankRoutingNumber);

  return {
    payoutMethod: typeof provider?.payoutMethod === 'string' ? provider.payoutMethod : undefined,
    wiseEmail: typeof provider?.wiseEmail === 'string' ? provider.wiseEmail : undefined,
    paypalEmail: typeof provider?.paypalEmail === 'string' ? provider.paypalEmail : undefined,
    zelleContact: typeof provider?.zelleContact === 'string' ? provider.zelleContact : undefined,
    bankName: typeof provider?.bankName === 'string' ? provider.bankName : undefined,
    bankCountry: typeof provider?.bankCountry === 'string' ? provider.bankCountry : undefined,
    accountHolderName: typeof provider?.accountHolderName === 'string' ? provider.accountHolderName : undefined,
    hasBankAccountNumber: !!bankAccountLast4,
    bankAccountNumberLast4: bankAccountLast4,
    hasBankRoutingNumber: !!bankRoutingLast4,
    bankRoutingNumberLast4: bankRoutingLast4,
  };
}

export async function GET(_request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const provider = await getProviderByUserId(session.userId);
    if (!provider) return NextResponse.json({ success: false, error: 'Provider profile not found' }, { status: 404 });

    return NextResponse.json({ success: true, payoutDetails: toResponsePayload(provider) }, { status: 200 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/provider/payout-details] GET' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth.requireProvider();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    const provider = await getProviderByUserId(session.userId);
    if (!provider) return NextResponse.json({ success: false, error: 'Provider profile not found' }, { status: 404 });

    const validationResult = await validateRequestBody(request, providerPayoutDetailsSchema);
    if (!validationResult.success) return validationResult.response;

    const data = validationResult.data;
    const payoutMethod = data.payoutMethod;

    if (payoutMethod === 'wise') {
      const wiseEmail = data.wiseEmail ?? (provider as any)?.wiseEmail;
      if (!wiseEmail) {
        return NextResponse.json({ success: false, error: 'wiseEmail is required for Wise payouts' }, { status: 400 });
      }
      const updated = await updateProviderPayoutDetailsByUserId(session.userId, { payoutMethod, wiseEmail } as any);
      if (!updated) return NextResponse.json({ success: false, error: 'Provider profile not found' }, { status: 404 });
      return NextResponse.json({ success: true, payoutDetails: toResponsePayload(updated) }, { status: 200 });
    }

    if (payoutMethod === 'paypal') {
      const paypalEmail = data.paypalEmail ?? (provider as any)?.paypalEmail;
      if (!paypalEmail) {
        return NextResponse.json({ success: false, error: 'paypalEmail is required for PayPal payouts' }, { status: 400 });
      }
      const updated = await updateProviderPayoutDetailsByUserId(session.userId, { payoutMethod, paypalEmail } as any);
      if (!updated) return NextResponse.json({ success: false, error: 'Provider profile not found' }, { status: 404 });
      return NextResponse.json({ success: true, payoutDetails: toResponsePayload(updated) }, { status: 200 });
    }

    if (payoutMethod === 'zelle') {
      const zelleContact = data.zelleContact ?? (provider as any)?.zelleContact;
      if (!zelleContact) {
        return NextResponse.json({ success: false, error: 'zelleContact is required for Zelle payouts' }, { status: 400 });
      }
      const updated = await updateProviderPayoutDetailsByUserId(session.userId, { payoutMethod, zelleContact } as any);
      if (!updated) return NextResponse.json({ success: false, error: 'Provider profile not found' }, { status: 404 });
      return NextResponse.json({ success: true, payoutDetails: toResponsePayload(updated) }, { status: 200 });
    }

    if (payoutMethod === 'bank') {
      const bankName = data.bankName ?? (provider as any)?.bankName;
      const bankCountryRaw = data.bankCountry ?? (provider as any)?.bankCountry;
      const bankCountry = typeof bankCountryRaw === 'string' ? bankCountryRaw.trim().toUpperCase() : undefined;
      const bankAccountNumber = data.bankAccountNumber ?? (provider as any)?.bankAccountNumber;
      const bankRoutingNumber = data.bankRoutingNumber ?? (provider as any)?.bankRoutingNumber;
      const accountHolderName = data.accountHolderName ?? (provider as any)?.accountHolderName;

      if (!bankName) {
        return NextResponse.json({ success: false, error: 'bankName is required for bank payouts' }, { status: 400 });
      }
      if (!bankCountry || bankCountry.length !== 2) {
        return NextResponse.json(
          { success: false, error: 'bankCountry is required for bank payouts (2-letter country code)' },
          { status: 400 }
        );
      }
      if (!bankAccountNumber) {
        return NextResponse.json({ success: false, error: 'bankAccountNumber is required for bank payouts' }, { status: 400 });
      }
      if (!bankRoutingNumber) {
        return NextResponse.json({ success: false, error: 'bankRoutingNumber is required for bank payouts' }, { status: 400 });
      }

      const updated = await updateProviderPayoutDetailsByUserId(session.userId, {
        payoutMethod,
        bankName,
        bankCountry,
        bankAccountNumber,
        bankRoutingNumber,
        ...(typeof accountHolderName === 'string' && accountHolderName.trim() ? { accountHolderName: accountHolderName.trim() } : {}),
      } as any);
      if (!updated) return NextResponse.json({ success: false, error: 'Provider profile not found' }, { status: 404 });
      return NextResponse.json({ success: true, payoutDetails: toResponsePayload(updated) }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: 'Invalid payout method' }, { status: 400 });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/provider/payout-details] POST' });
  }
}

