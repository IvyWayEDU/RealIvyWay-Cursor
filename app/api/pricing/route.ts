import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import { resolvePricing, mapToPlanType } from '@/lib/pricing/resolver';
import { handleApiError } from '@/lib/errorHandler';

/**
 * GET /api/pricing
 * Returns pricing breakdown for checkout summary display
 * 
 * SECURITY: Authentication required
 * Query parameters:
 * - service: Service type (tutoring, test-prep, counseling, virtual-tour)
 * - plan: Plan type (optional, will be inferred from service if not provided)
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await auth.require();
    if (authResult.error) return authResult.error;
    const session = authResult.session!;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const plan = searchParams.get('plan');

    if (!service) {
      return NextResponse.json(
        { error: 'Service parameter is required' },
        { status: 400 }
      );
    }

    // Resolve pricing using shared resolver
    const pricing = resolvePricing(service, plan);

    if (!pricing) {
      return NextResponse.json(
        { 
          error: 'Invalid service or plan combination',
          details: `service: ${service}, plan: ${plan || 'null'}`
        },
        { status: 400 }
      );
    }

    // Calculate final amounts
    // Note: Discount calculation is handled client-side in the summary page
    // based on the user's selected credit. Tax is now calculated by the resolver.
    const subtotalCents = pricing.totalBaseAmount;

    return NextResponse.json({
      pricing: {
        baseAmountCents: pricing.baseAmountCents,
        quantity: pricing.quantity,
        totalBaseAmount: pricing.totalBaseAmount,
        taxCents: pricing.taxCents,
        totalCents: pricing.totalCents,
        sessionsCount: pricing.sessionsCount,
        durationMinutes: pricing.durationMinutes,
        label: pricing.label,
        isTaxable: pricing.isTaxable,
        serviceKey: pricing.serviceKey,
        planType: pricing.planType,
        // Legacy fields for backward compatibility
        baseAmount: pricing.baseAmountCents,
        taxable: pricing.isTaxable,
      },
      breakdown: {
        subtotalCents,
        // Discount is calculated client-side based on selected credit
        // Tax is now included in pricing.taxCents from the resolver
      },
      planType: pricing.planType,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/pricing]' });
  }
}

