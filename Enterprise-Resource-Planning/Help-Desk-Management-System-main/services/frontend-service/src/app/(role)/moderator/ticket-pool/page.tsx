'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { ticketPoolPreset } from '@/components/tickets/presets';

export default function TicketPoolPage() {
  const { user } = useAuth();
  if (!user) return null;
  const role = user.role ?? 'moderator';
  return <TicketListView preset={ticketPoolPreset(role)} />;
}
