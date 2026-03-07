"use strict";
/**
 * Centralized Provider Payout Logic (platform-wide)
 *
 * IMPORTANT:
 * - Do NOT change customer pricing here.
 * - This only defines how much the provider earns per completed session.
 * - All values are flat per-session earnings (USD, dollars).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProviderPayout = getProviderPayout;
function getProviderPayout(serviceType) {
    const raw = typeof serviceType === 'string' ? serviceType : String(serviceType ?? '');
    const norm = raw.trim().toLowerCase().replace(/-/g, '_');
    // Normalize legacy/internal variants
    const key = norm === 'counseling' ? 'college_counseling'
        : norm === 'testprep' ? 'test_prep'
            : norm === 'virtual_tours' ? 'virtual_tour'
                : norm;
    const payout = key === 'tutoring' ? 48
        : key === 'college_counseling' ? 50
            : key === 'test_prep' ? 70
                : key === 'virtual_tour' ? 75
                    : 0;
    // DEV TEST: server-only debug log (avoid browser console spam)
    const hasWindow = typeof globalThis?.window !== 'undefined';
    if (!hasWindow && process.env.NODE_ENV !== 'production') {
        console.log('[PROVIDER_PAYOUT_DEBUG]', { serviceType: key, payout });
    }
    return payout;
}
