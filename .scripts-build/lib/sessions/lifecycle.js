"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionEndTimeMs = getSessionEndTimeMs;
exports.isSessionCompleted = isSessionCompleted;
exports.isSessionUpcoming = isSessionUpcoming;
function getSessionEndTimeMs(session) {
    const iso = 
    // Preferred canonical field (per product spec)
    session?.endTimeUTC ??
        session?.endTime ??
        session?.scheduledEndTime ??
        session?.scheduledEnd ??
        session?.end;
    if (typeof iso !== 'string')
        return null;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
}
/**
 * Canonical "completed" rule (per CURRENT spec):
 * - session.status === "completed"
 */
function isSessionCompleted(session, nowMs = Date.now()) {
    const status = typeof session?.status === 'string' ? session.status : '';
    if (status === 'completed')
        return true;
    // Dev/admin override statuses should still be treated as completed everywhere.
    if (status === 'completed_provider_show')
        return true;
    if (status === 'completed_no_show_provider')
        return true;
    if (status === 'completed_no_show_student')
        return true;
    return false;
}
/**
 * Canonical "upcoming" rule (per CURRENT spec):
 * - session.status === "confirmed"
 * AND
 * - now < session.endTimeUTC (or equivalent)
 */
function isSessionUpcoming(session, nowMs = Date.now()) {
    const status = typeof session?.status === 'string' ? session.status : '';
    if (status !== 'confirmed')
        return false;
    const endMs = getSessionEndTimeMs(session);
    return endMs !== null && nowMs < endMs;
}
