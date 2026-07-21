'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { myTasksPreset } from '@/components/tickets/presets';

export default function MyTasksPage() {
  const { user } = useAuth();
  if (!user?.id) return null;
  const role = user.role ?? 'assignee';
  return <TicketListView preset={myTasksPreset(user.id, role)} />;
}
