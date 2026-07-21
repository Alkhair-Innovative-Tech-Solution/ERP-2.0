'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { myRequestsPreset } from '@/components/tickets/presets';

export default function RequestsPage() {
  const { user } = useAuth();
  if (!user?.id) return null;
  const role = user.role ?? 'requestor';
  return <TicketListView preset={myRequestsPreset(user.id, role)} />;
}
