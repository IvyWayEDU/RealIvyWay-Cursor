'use client';

import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

/**
 * Hook to send provider or student heartbeat every 15 seconds
 * Only runs on client side
 * 
 * @param sessionId - The session ID to send heartbeat for
 * @param enabled - Whether heartbeat should be active
 * @param role - 'provider' or 'student'
 */
export function useProviderSessionHeartbeat(
  sessionId: string | null,
  enabled: boolean,
  role: 'provider' | 'student' = 'provider'
): void {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasJoinedRef = useRef<boolean>(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') {
      return;
    }

    // If disabled or no sessionId, do nothing
    if (!enabled || !sessionId) {
      return;
    }

    // Send heartbeat tick
    const sendHeartbeatTick = async () => {
      try {
        const response = await fetch('/api/sessions/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            role,
            event: 'tick',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          logger.debug('heartbeat', 'tick ok', {
            sessionId,
            role,
            status: data.status,
            providerAccumulatedSeconds: data.providerAccumulatedSeconds || 0,
          });
          
          // Stop interval if session is in terminal state (canonical)
          const terminalStates = ['completed', 'flagged', 'cancelled'];
          if (terminalStates.includes(data.status)) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        } else {
          logger.error('heartbeat', 'tick failed', { sessionId, status: response.status });
        }
      } catch (error) {
        logger.error('heartbeat', 'tick error', { sessionId, error });
      }
    };

    // Send join event if not already joined
    const sendJoin = async () => {
      if (hasJoinedRef.current) return;
      
      try {
        const response = await fetch('/api/sessions/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            role,
            event: 'join',
          }),
        });

        if (response.ok) {
          hasJoinedRef.current = true;
          logger.debug('heartbeat', 'joined', { sessionId, role });
        }
      } catch (error) {
        logger.error('heartbeat', 'join error', { sessionId, role, error });
      }
    };

    // Send leave event
    const sendLeave = async () => {
      try {
        // Use fetch with keepalive for best effort on page unload
        await fetch('/api/sessions/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            role,
            event: 'leave',
          }),
          keepalive: true, // Ensures request completes even if page unloads
        });
        logger.debug('heartbeat', 'left', { sessionId, role });
      } catch (error) {
        logger.error('heartbeat', 'leave error', { sessionId, role, error });
      }
    };

    // Send join event immediately
    sendJoin();

    // Set up interval to send heartbeat tick every 15 seconds
    intervalRef.current = setInterval(() => {
      sendHeartbeatTick();
    }, 15000); // 15 seconds

    // Handle page unload - send leave event
    const handleBeforeUnload = () => {
      sendLeave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup: clear interval and send leave on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Send leave event on unmount
      sendLeave();
    };
  }, [sessionId, enabled, role]);
}

