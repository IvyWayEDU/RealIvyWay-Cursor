'use client';

import { useEffect } from 'react';

interface DebugLineProps {
  userRole: 'student' | 'provider';
}

export default function DebugLine({ userRole }: DebugLineProps) {
  void userRole;

  useEffect(() => {
    // Dev session helpers have been removed. This debug line is intentionally disabled.
  }, [userRole]);

  return null;
}



