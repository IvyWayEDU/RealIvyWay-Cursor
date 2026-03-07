'use client';

import { useEffect, useRef } from 'react';

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
          console.log(`[HEARTBEAT_OK] ${sessionId} ${role} status:${data.status} providerSeconds:${data.providerAccumulatedSeconds || 0}`);
          
          // Stop interval if session is in terminal state (canonical)
          const terminalStates = ['completed', 'flagged', 'cancelled'];
          if (terminalStates.includes(data.status)) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        } else {
          console.error('[HEARTBEAT] failed', sessionId, response.status);
        }
      } catch (error) {
        console.error('[HEARTBEAT] error', sessionId, error);
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
          console.log(`[HEARTBEAT] ${sessionId} ${role} joined`);
        }
      } catch (error) {
        console.error('[HEARTBEAT] join error', sessionId, error);
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
        console.log(`[HEARTBEAT] ${sessionId} ${role} left`);
      } catch (error) {
        console.error('[HEARTBEAT] leave error', sessionId, error);
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

