'use client';

import { useEffect, useState } from 'react';
import { getDevSessions } from '@/lib/devSessionStore';
import { getCurrentUserId } from '@/lib/sessions/actions';

interface DebugLineProps {
  userRole: 'student' | 'provider';
}

export default function DebugLine({ userRole }: DebugLineProps) {
  const [sessionCount, setSessionCount] = useState(0);
  const [userId, setUserId] = useState<string>('');
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const updateDebug = async () => {
      // Get session count from localStorage
      const sessions = getDevSessions();
      setSessionCount(sessions.length);
      
      // Get current user id
      const { userId: currentUserId } = await getCurrentUserId();
      setUserId(currentUserId || 'Not logged in');
      setRole(userRole);
    };

    updateDebug();
    
    // Refresh every second to catch updates
    const interval = setInterval(updateDebug, 1000);
    return () => clearInterval(interval);
  }, [userRole]);

  return (
    <div className="text-xs text-gray-600 mb-2 px-1">
      Sessions in storage: {sessionCount} | Current user id: {userId} | Current role: {role}
    </div>
  );
}

