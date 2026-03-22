import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { getSessions, updateSession } from '@/lib/sessions/storage';
import { Session } from '@/lib/models/types';
import { handleApiError } from '@/lib/errorHandler';

/**
 * Retroactive migration script to fix already completed sessions in dev
 * 
 * This endpoint:
 * 1. Finds all sessions with status='completed' but payoutStatus != 'earned' (or missing)
 * 2. Updates them to have payoutStatus='earned'
 * 3. Sets completedAt if missing
 * 4. (No earnings snapshots) Earnings are derived dynamically from completed sessions
 * 
 * Only works in development mode and requires admin access
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This migration script only works in development mode' },
        { status: 403 }
      );
    }

    // Verify user session
    const auth = await getAuthContext();
    if (auth.status === 'suspended') return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    if (auth.status !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = auth.session;

    // TEMP_ADMIN_MODE: Check if user is admin or temp admin
    const { isTempAdmin } = await import('@/lib/auth/tempAdmin');
    const isAdmin = session.roles.includes('admin') || isTempAdmin(session.userId);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can run this migration' },
        { status: 403 }
      );
    }

    // Get all sessions
    const allSessions = await getSessions();

    // Find sessions that need migration:
    // - status = 'completed'
    // - payoutStatus missing (normalize to 'available')
    const sessionsToMigrate = allSessions.filter(s => {
      if (s.status !== 'completed') return false;
      if (s.payoutStatus) return false;
      return true;
    });

    if (sessionsToMigrate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sessions need migration',
        migratedCount: 0,
      });
    }

    let migratedCount = 0;
    const errors: string[] = [];

    // Migrate each session
    for (const sessionToMigrate of sessionsToMigrate) {
      try {
        const now = new Date().toISOString();
        const updateData: Partial<Session> = {
          payoutStatus: 'available',
          updatedAt: now,
        };

        // Set completedAt if missing
        if (!sessionToMigrate.completedAt) {
          // Use actualEndTime if available, otherwise use updatedAt, otherwise use now
          updateData.completedAt = sessionToMigrate.actualEndTime || sessionToMigrate.updatedAt || now;
        }

        // Update session
        const updateSuccess = await updateSession(sessionToMigrate.id, updateData);

        if (updateSuccess) {
          migratedCount++;

          console.log('Session migrated:', {
            sessionId: sessionToMigrate.id,
            providerId: sessionToMigrate.providerId,
            oldPayoutStatus: sessionToMigrate.payoutStatus,
            newPayoutStatus: 'available',
          });
        } else {
          errors.push(`Failed to update session ${sessionToMigrate.id}`);
        }
      } catch (error) {
        const errorMsg = `Error migrating session ${sessionToMigrate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed: ${migratedCount} sessions migrated`,
      migratedCount,
      totalSessions: sessionsToMigrate.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/sessions/migrate-completed]' });
  }
}



