'use client';

import { useState, useEffect } from 'react';

export function useCurrentTime(refreshMs: number = 60000): Date {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return now;
}
