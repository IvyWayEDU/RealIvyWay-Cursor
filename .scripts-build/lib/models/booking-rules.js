"use strict";
/**
 * Booking System Rules and Ownership
 *
 * This file defines the business rules for the booking system:
 * - Ownership rules (who can create, view, cancel)
 * - Access control rules
 * - Cancellation and no-show policies
 *
 * These rules should be enforced in all booking-related operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoShowPolicy = exports.CancellationPolicy = exports.SessionOwnership = exports.AvailabilityOwnership = exports.ServiceTypeOwnership = void 0;
exports.checkBookingPermission = checkBookingPermission;
/**
 * OWNERSHIP RULES
 *
 * Defines who owns and can perform actions on booking entities
 */
/**
 * ServiceType Ownership Rules
 */
exports.ServiceTypeOwnership = {
    /**
     * Who can create a ServiceType
     * - Providers (tutors/counselors) can create service types for themselves
     * - Admins can create service types for any provider
     */
    canCreate: (userRole) => {
        return userRole === 'tutor' || userRole === 'counselor' || userRole === 'admin';
    },
    /**
     * Who can view a ServiceType
     * - Public: Anyone can view active service types
     * - Providers can view their own service types (including inactive)
     * - Admins can view all service types
     */
    canView: (serviceType, viewerId, viewerRole) => {
        // Admins can view everything
        if (viewerRole === 'admin')
            return true;
        // Provider can view their own service types
        if (serviceType.providerId === viewerId)
            return true;
        // Public can view active service types
        if (serviceType.active)
            return true;
        return false;
    },
    /**
     * Who can update a ServiceType
     * - Provider can update their own service types
     * - Admins can update any service type
     */
    canUpdate: (serviceType, userId, userRole) => {
        if (userRole === 'admin')
            return true;
        return serviceType.providerId === userId && (userRole === 'tutor' || userRole === 'counselor');
    },
    /**
     * Who can delete a ServiceType
     * - Provider can delete their own service types (if no active sessions)
     * - Admins can delete any service type
     */
    canDelete: (serviceType, userId, userRole) => {
        if (userRole === 'admin')
            return true;
        return serviceType.providerId === userId && (userRole === 'tutor' || userRole === 'counselor');
    },
};
/**
 * Availability Ownership Rules
 */
exports.AvailabilityOwnership = {
    /**
     * Who can create an Availability
     * - Providers can create availability for themselves
     * - Admins can create availability for any provider
     */
    canCreate: (userRole) => {
        return userRole === 'tutor' || userRole === 'counselor' || userRole === 'admin';
    },
    /**
     * Who can view an Availability
     * - Students can view available slots (status === 'available')
     * - Providers can view their own availability (all statuses)
     * - Admins can view all availability
     */
    canView: (availability, viewerId, viewerRole) => {
        // Admins can view everything
        if (viewerRole === 'admin')
            return true;
        // Provider can view their own availability
        if (availability.providerId === viewerId)
            return true;
        // Students can view available slots
        if (viewerRole === 'student' && availability.status === 'available')
            return true;
        return false;
    },
    /**
     * Who can update an Availability
     * - Provider can update their own availability (if not booked)
     * - Admins can update any availability
     */
    canUpdate: (availability, userId, userRole) => {
        if (userRole === 'admin')
            return true;
        // Provider can only update their own availability if it's not booked
        if (availability.providerId === userId && availability.status !== 'booked') {
            return userRole === 'tutor' || userRole === 'counselor';
        }
        return false;
    },
    /**
     * Who can delete an Availability
     * - Provider can delete their own availability (if not booked)
     * - Admins can delete any availability
     */
    canDelete: (availability, userId, userRole) => {
        if (userRole === 'admin')
            return true;
        // Provider can only delete their own availability if it's not booked
        if (availability.providerId === userId && availability.status !== 'booked') {
            return userRole === 'tutor' || userRole === 'counselor';
        }
        return false;
    },
};
/**
 * Session Ownership Rules
 */
exports.SessionOwnership = {
    /**
     * Who can create a Session (book a session)
     * - Students can book sessions
     * - Providers can book sessions on behalf of students (for admin purposes)
     * - Admins can book sessions for anyone
     */
    canCreate: (userRole) => {
        return userRole === 'student' || userRole === 'tutor' || userRole === 'counselor' || userRole === 'admin';
    },
    /**
     * Who can view a Session
     * - Student can view their own sessions
     * - Provider can view sessions they're providing
     * - Admins can view all sessions
     */
    canView: (session, viewerId, viewerRole) => {
        // Admins can view everything
        if (viewerRole === 'admin')
            return true;
        // Student can view their own sessions
        if (viewerRole === 'student' && session.studentId === viewerId)
            return true;
        // Provider can view their own sessions
        if ((viewerRole === 'tutor' || viewerRole === 'counselor') && session.providerId === viewerId) {
            return true;
        }
        return false;
    },
    /**
     * Who can cancel a Session
     * - Student can cancel their own sessions
     * - Provider can cancel sessions they're providing
     * - Admins can cancel any session
     */
    canCancel: (session, userId, userRole) => {
        // Admins can cancel anything
        if (userRole === 'admin')
            return true;
        // Can only cancel if session is scheduled
        if (session.status !== 'scheduled')
            return false;
        // Student can cancel their own sessions
        if (userRole === 'student' && session.studentId === userId)
            return true;
        // Provider can cancel their own sessions
        if ((userRole === 'tutor' || userRole === 'counselor') && session.providerId === userId) {
            return true;
        }
        return false;
    },
    /**
     * Who can mark a Session as no-show
     * - Provider can mark their own sessions as no-show (student didn't show)
     * - Student can mark their own sessions as no-show (provider didn't show)
     * - Admins can mark any session as no-show
     */
    canMarkNoShow: (session, userId, userRole) => {
        // Admins can mark anything
        if (userRole === 'admin')
            return true;
        // Can only mark no-show if session is scheduled or completed
        if (session.status !== 'scheduled' && session.status !== 'completed')
            return false;
        // Provider can mark their own sessions as no-show
        if ((userRole === 'tutor' || userRole === 'counselor') && session.providerId === userId) {
            return true;
        }
        // Student can mark their own sessions as no-show
        if (userRole === 'student' && session.studentId === userId)
            return true;
        return false;
    },
    /**
     * Who can update a Session
     * - Provider can update notes for their own sessions
     * - Student can update notes for their own sessions
     * - Admins can update any session
     */
    canUpdate: (session, userId, userRole) => {
        if (userRole === 'admin')
            return true;
        // Provider can update their own sessions (limited fields like notes)
        if ((userRole === 'tutor' || userRole === 'counselor') && session.providerId === userId) {
            return true;
        }
        // Student can update their own sessions (limited fields like notes)
        if (userRole === 'student' && session.studentId === userId)
            return true;
        return false;
    },
};
/**
 * CANCELLATION AND NO-SHOW RULES
 *
 * Defines the business logic for cancellations and no-shows
 */
/**
 * Cancellation Policy
 *
 * Rule: 24-hour full charge policy
 * - If cancelled less than 24 hours before session start: Full charge (no refund)
 * - If cancelled 24+ hours before session start: Full refund
 */
exports.CancellationPolicy = {
    /**
     * Calculate refund amount based on cancellation time
     * @param session - The session being cancelled
     * @param cancelledAt - When the cancellation occurred (ISO 8601 string)
     * @returns Object with refund amount and whether full charge applies
     */
    calculateRefund: (session, cancelledAt) => {
        const sessionStart = new Date(session.scheduledStartTime);
        const cancellationTime = new Date(cancelledAt);
        // Calculate hours until session
        const hoursUntilSession = (sessionStart.getTime() - cancellationTime.getTime()) / (1000 * 60 * 60);
        // 24-hour policy: less than 24 hours = full charge, 24+ hours = full refund
        const isFullCharge = hoursUntilSession < 24;
        return {
            refundAmountCents: isFullCharge ? 0 : session.amountChargedCents,
            isFullCharge,
            hoursBeforeSession: Math.max(0, hoursUntilSession),
        };
    },
    /**
     * Check if a session can be cancelled (based on time)
     * Sessions can always be cancelled, but refund depends on timing
     */
    canCancel: (session, currentTime) => {
        // Can only cancel scheduled sessions
        if (session.status !== 'scheduled')
            return false;
        // Can cancel at any time (but refund policy applies)
        return true;
    },
};
/**
 * No-Show Policy
 *
 * Rule: No-show results in full charge (no refund)
 * - If student doesn't show: Full charge, no refund
 * - If provider doesn't show: Full refund to student
 * - If both don't show: Full refund to student
 */
exports.NoShowPolicy = {
    /**
     * Calculate charge/refund for no-show
     * @param session - The session with no-show
     * @param noShowParty - Who didn't show up
     * @returns Object with charge and refund amounts
     */
    calculateCharge: (session, noShowParty) => {
        if (noShowParty === 'student') {
            // Student no-show: full charge, no refund
            return {
                studentChargeCents: session.priceCents,
                providerChargeCents: 0,
                refundAmountCents: 0,
            };
        }
        else if (noShowParty === 'provider' || noShowParty === 'both') {
            // Provider no-show or both: full refund to student
            return {
                studentChargeCents: 0,
                providerChargeCents: 0,
                refundAmountCents: session.amountChargedCents,
            };
        }
        // Default: no charge
        return {
            studentChargeCents: 0,
            providerChargeCents: 0,
            refundAmountCents: 0,
        };
    },
    /**
     * Check if a session can be marked as no-show
     * Can only mark no-show if:
     * - Session is scheduled and start time has passed, OR
     * - Session is completed
     */
    canMarkNoShow: (session, currentTime) => {
        // Can mark no-show if session is completed
        if (session.status === 'completed')
            return true;
        // Can mark no-show if session is scheduled and start time has passed
        if (session.status === 'scheduled') {
            const sessionStart = new Date(session.scheduledStartTime);
            const now = new Date(currentTime);
            return now >= sessionStart;
        }
        return false;
    },
};
/**
 * Helper function to check if a user has permission for an action
 */
function checkBookingPermission(entity, action, userId, userRole, ownershipRules) {
    switch (action) {
        case 'create':
            return ownershipRules.canCreate?.(userRole) ?? false;
        case 'view':
            return ownershipRules.canView?.(entity, userId, userRole) ?? false;
        case 'update':
            return ownershipRules.canUpdate?.(entity, userId, userRole) ?? false;
        case 'delete':
            return ownershipRules.canDelete?.(entity, userId, userRole) ?? false;
        case 'cancel':
            return ownershipRules.canCancel?.(entity, userId, userRole) ?? false;
        case 'markNoShow':
            return ownershipRules.canMarkNoShow?.(entity, userId, userRole) ?? false;
        default:
            return false;
    }
}
