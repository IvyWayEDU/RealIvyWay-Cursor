"use strict";
/**
 * Shared Pricing Resolver
 *
 * This module provides a single source of truth for pricing calculations
 * across the application. It ensures consistency between UI display and
 * Stripe checkout session creation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToPlanType = mapToPlanType;
exports.resolvePricing = resolvePricing;
exports.validateMonthlyPlanPricing = validateMonthlyPlanPricing;
exports.getServiceKey = getServiceKey;
exports.formatPrice = formatPrice;
const PRICING_MAP = {
    'tutoring-single': {
        baseAmount: 6900,
        quantity: 1,
        sessionsCount: 1,
        durationMinutes: 60,
        label: 'Single Tutoring Session',
        serviceKey: 'tutoring_single'
    },
    'tutoring-monthly': {
        baseAmount: 24900,
        quantity: 1,
        sessionsCount: 4,
        durationMinutes: 60,
        label: 'Monthly Tutoring Package',
        serviceKey: 'tutoring_monthly'
    },
    'test-prep-single': {
        baseAmount: 14900,
        quantity: 1,
        sessionsCount: 1,
        durationMinutes: 60,
        label: 'Single Test Prep Session',
        serviceKey: 'test_prep_single'
    },
    'test-prep-monthly': {
        baseAmount: 49900,
        quantity: 1,
        sessionsCount: 4,
        durationMinutes: 60,
        label: 'Monthly Test Prep Bundle',
        serviceKey: 'test_prep_monthly'
    },
    'counseling-single': {
        baseAmount: 8900,
        quantity: 1,
        sessionsCount: 1,
        durationMinutes: 60,
        label: 'College Counseling',
        serviceKey: 'counseling_single'
    },
    'counseling-monthly': {
        baseAmount: 29900,
        quantity: 1,
        sessionsCount: 4,
        durationMinutes: 60,
        label: 'Monthly Counseling Plan',
        serviceKey: 'counseling_monthly'
    },
    'virtual-tour-single': {
        baseAmount: 12400,
        quantity: 1,
        sessionsCount: 1,
        durationMinutes: 60, // Live guided tour, approximate duration
        label: 'Single Virtual College Tour',
        serviceKey: 'virtual_tour_single'
    },
};
/**
 * Maps service and plan from booking state to PlanType
 */
function mapToPlanType(service, plan) {
    if (!service)
        return null;
    // If plan is already a valid PlanType, return it
    if (plan && Object.keys(PRICING_MAP).includes(plan)) {
        return plan;
    }
    // Map service + plan combination to PlanType
    switch (service) {
        case 'tutoring':
            if (plan === 'tutoring-monthly')
                return 'tutoring-monthly';
            return 'tutoring-single'; // Default to single
        case 'test-prep':
            if (plan === 'test-prep-monthly')
                return 'test-prep-monthly';
            return 'test-prep-single'; // Default to single
        case 'counseling':
            if (plan === 'counseling-monthly')
                return 'counseling-monthly';
            // Counseling is 60 minutes only; no duration selection.
            return 'counseling-single';
        case 'virtual-tour':
            return 'virtual-tour-single';
        default:
            return null;
    }
}
/**
 * Tax rate as a decimal (e.g., 0.085 for 8.5%)
 * This is a standard rate used for tax calculation
 */
const TAX_RATE = 0.085; // 8.5%
/**
 * Calculates tax amount in cents for a given base amount
 *
 * @param baseAmountCents - Base amount in cents
 * @param isTaxable - Whether tax should be applied
 * @returns Tax amount in cents (rounded to nearest cent)
 */
function calculateTaxCents(baseAmountCents, isTaxable) {
    if (!isTaxable) {
        return 0;
    }
    // Round to nearest cent
    return Math.round(baseAmountCents * TAX_RATE);
}
/**
 * Resolves pricing for a given service and plan
 *
 * @param serviceType - Service type from booking state
 * @param planType - Plan type (can be null, will be inferred from serviceType)
 * @returns Pricing breakdown or null if invalid
 */
function resolvePricing(serviceType, planType) {
    const mappedPlanType = mapToPlanType(serviceType, planType);
    if (!mappedPlanType) {
        return null;
    }
    const pricing = PRICING_MAP[mappedPlanType];
    if (!pricing) {
        return null;
    }
    const totalBaseAmount = pricing.baseAmount * pricing.quantity;
    const isTaxable = true; // All paid services are taxable
    const taxCents = calculateTaxCents(totalBaseAmount, isTaxable);
    const totalCents = totalBaseAmount + taxCents;
    return {
        baseAmountCents: pricing.baseAmount,
        quantity: pricing.quantity,
        totalBaseAmount,
        taxCents,
        totalCents,
        sessionsCount: pricing.sessionsCount,
        durationMinutes: pricing.durationMinutes,
        label: pricing.label,
        isTaxable,
        serviceKey: pricing.serviceKey,
        planType: mappedPlanType,
        // Legacy fields for backward compatibility
        baseAmount: pricing.baseAmount,
        taxable: isTaxable,
    };
}
/**
 * Validates that monthly plan pricing matches expected full package price
 *
 * @param planType - Plan type to validate
 * @param totalBaseAmount - Total base amount to validate
 * @throws Error if validation fails
 */
function validateMonthlyPlanPricing(planType, totalBaseAmount) {
    const monthlyPlans = [
        'tutoring-monthly',
        'test-prep-monthly',
        'counseling-monthly',
    ];
    if (monthlyPlans.includes(planType)) {
        const expectedPricing = PRICING_MAP[planType];
        if (!expectedPricing) {
            throw new Error(`No pricing found for plan type: ${planType}`);
        }
        const expectedTotal = expectedPricing.baseAmount * expectedPricing.quantity;
        if (totalBaseAmount !== expectedTotal) {
            throw new Error(`Monthly plan pricing mismatch: ` +
                `planType=${planType}, ` +
                `expected=${expectedTotal} cents ($${(expectedTotal / 100).toFixed(2)}), ` +
                `actual=${totalBaseAmount} cents ($${(totalBaseAmount / 100).toFixed(2)})`);
        }
    }
}
/**
 * Gets service key from plan type
 * Throws error if plan type is invalid
 */
function getServiceKey(planType) {
    if (!planType) {
        throw new Error('Plan type is required');
    }
    const pricing = PRICING_MAP[planType];
    if (!pricing) {
        throw new Error(`Invalid plan type: ${planType}`);
    }
    return pricing.serviceKey;
}
/**
 * Formats price in cents to dollar string
 */
function formatPrice(cents) {
    return `$${(cents / 100).toFixed(2)}`;
}
