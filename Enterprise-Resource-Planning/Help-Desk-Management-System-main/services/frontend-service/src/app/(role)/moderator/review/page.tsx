'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { reviewQueuePreset } from '@/components/tickets/presets';

export default function ReviewPage() {
  const { user } = useAuth();
  if (!user) return null;
  const role = user.role ?? 'moderator';
  return <TicketListView preset={reviewQueuePreset(role)} />;
}
