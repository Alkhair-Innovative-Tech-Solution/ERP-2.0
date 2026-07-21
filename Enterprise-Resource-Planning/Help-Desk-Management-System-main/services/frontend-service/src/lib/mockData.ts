/**
 * Mock Data for Development
 * Hard-coded data for requestor Dashboard
 */

import { Ticket } from '../types';

// Hard-coded tickets for requestor
export const getMockTickets = (requestorId: string): Ticket[] => {
  return [
    {
      id: 'mock-draft-1',
      ticketId: 'D-001',
      subject: 'Draft Request',
      description: 'This is a draft request that has not been submitted yet.',
      department: 'IT',
      priority: 'low',
      status: 'draft',
      requestorId: requestorId,
      requestorName: 'John Requestor',
      submittedDate: new Date().toISOString(),
    },
    {
      id: '1',
      ticketId: 'HD-001',
      subject: 'Laptop not turning on',
      description: 'My laptop stopped working suddenly. It was working fine yesterday.',
      department: 'IT',
      priority: 'high',
      status: 'in_progress',
      requestorId: requestorId,
      requestorName: 'John requestor',
      assigneeId: '3',
      assigneeName: 'IT Support',
      submittedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      ticketId: 'HD-002',
      subject: 'Printer paper jam',
      description: 'Printer in office is jammed, need urgent fix',
      department: 'IT',
      priority: 'medium',
      status: 'pending',
      requestorId: requestorId,
      requestorName: 'John requestor',
      submittedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      ticketId: 'HD-003',
      subject: 'Network connectivity issues',
      description: 'WiFi keeps disconnecting in my area',
      department: 'IT',
      priority: 'high',
      status: 'resolved',
      requestorId: requestorId,
      requestorName: 'John requestor',
      assigneeId: '3',
      assigneeName: 'IT Support',
      submittedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      ticketId: 'HD-004',
      subject: 'Need new keyboard',
      description: 'Current keyboard keys are not working properly',
      department: 'Procurement',
      priority: 'low',
      status: 'completed',
      requestorId: requestorId,
      requestorName: 'John requestor',
      assigneeId: '5',
      assigneeName: 'Procurement Team',
      submittedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      completedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      ticketId: 'HD-005',
      subject: 'Light bulb replacement needed',
      description: 'Light in room 205 is not working',
      department: 'Basic Maintenance',
      priority: 'medium',
      status: 'resolved',
      requestorId: requestorId,
      requestorName: 'John requestor',
      assigneeId: '6',
      assigneeName: 'Maintenance Team',
      submittedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '6',
      ticketId: 'HD-006',
      subject: 'Office chair repair',
      description: 'Chair wheel is broken',
      department: 'Basic Maintenance',
      priority: 'low',
      status: 'in_progress',
      requestorId: requestorId,
      requestorName: 'John requestor',
      assigneeId: '6',
      assigneeName: 'Maintenance Team',
      submittedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '7',
      ticketId: 'HD-007',
      subject: 'Request for leave approval',
      description: 'Need approval for 3 days leave',
      department: 'Administration',
      priority: 'medium',
      status: 'pending',
      requestorId: requestorId,
      requestorName: 'John requestor',
      submittedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '8',
      ticketId: 'HD-008',
      subject: 'Software license renewal',
      description: 'Need to renew Microsoft Office license',
      department: 'IT',
      priority: 'high',
      status: 'resolved',
      requestorId: requestorId,
      requestorName: 'John requestor',
      assigneeId: '3',
      assigneeName: 'IT Support',
      submittedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

// Get a single mock ticket by ID
export const getMockTicketById = (ticketId: string, requestorId?: string): Ticket | null => {
  const tickets = getMockTickets(requestorId || '1');
  return tickets.find(t => t.id === ticketId || t.ticketId === ticketId) || null;
};

// Calculate statistics from tickets
export const calculateTicketStats = (tickets: Ticket[]) => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Filter resolved tickets this month
  const resolvedThisMonth = tickets.filter(t => {
    if (!t.resolvedDate) return false;
    const resolvedDate = new Date(t.resolvedDate);
    return resolvedDate >= thisMonthStart && resolvedDate <= now;
  });

  // Filter resolved tickets last month
  const resolvedLastMonth = tickets.filter(t => {
    if (!t.resolvedDate) return false;
    const resolvedDate = new Date(t.resolvedDate);
    return resolvedDate >= lastMonthStart && resolvedDate <= lastMonthEnd;
  });

  // Calculate average resolution time
  const resolvedTickets = tickets.filter(t => t.resolvedDate && t.submittedDate);
  const totalResolutionDays = resolvedTickets.reduce((sum, ticket) => {
    const submitted = new Date(ticket.submittedDate);
    const resolved = new Date(ticket.resolvedDate!);
    const days = (resolved.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);
  const avgResolutionTime = resolvedTickets.length > 0
    ? totalResolutionDays / resolvedTickets.length
    : 0;

  // Calculate previous month average
  const lastMonthResolved = resolvedTickets.filter(t => {
    const resolvedDate = new Date(t.resolvedDate!);
    return resolvedDate >= lastMonthStart && resolvedDate <= lastMonthEnd;
  });
  const lastMonthAvg = lastMonthResolved.length > 0
    ? lastMonthResolved.reduce((sum, ticket) => {
      const submitted = new Date(ticket.submittedDate);
      const resolved = new Date(ticket.resolvedDate!);
      const days = (resolved.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0) / lastMonthResolved.length
    : avgResolutionTime;

  const resolutionTimeTrend = lastMonthAvg > 0
    ? ((avgResolutionTime - lastMonthAvg) / lastMonthAvg) * 100
    : 0;

  // Open tickets (pending + in_progress)
  const openTickets = tickets.filter(t =>
    t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress'
  );

  // Total requests
  const totalRequests = tickets.length;

  // Resolved count trend
  const resolvedTrend = resolvedLastMonth.length > 0
    ? ((resolvedThisMonth.length - resolvedLastMonth.length) / resolvedLastMonth.length) * 100
    : resolvedThisMonth.length > 0 ? 100 : 0;

  return {
    totalRequests,
    openTickets: openTickets.length,
    resolvedThisMonth: resolvedThisMonth.length,
    avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
    resolutionTimeTrend: Math.round(resolutionTimeTrend * 10) / 10,
    resolvedTrend: Math.round(resolvedTrend * 10) / 10,
  };
};

// Get priority distribution
export const getPriorityDistribution = (tickets: Ticket[]) => {
  const distribution = {
    high: tickets.filter(t => t.priority === 'high').length,
    medium: tickets.filter(t => t.priority === 'medium').length,
    low: tickets.filter(t => t.priority === 'low').length,
  };

  return [
    { name: 'High', value: distribution.high, color: '#f87171' },
    { name: 'Medium', value: distribution.medium, color: '#fbbf24' },
    { name: 'Low', value: distribution.low, color: '#34d399' },
  ].filter(item => item.value > 0);
};

// Get status distribution
export const getStatusDistribution = (tickets: Ticket[]) => {
  const statusCounts: Record<string, number> = {};

  tickets.forEach(ticket => {
    const status = ticket.status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const STATUS_COLORS: Record<string, string> = {
    'draft': '#9ca3af',
    'pending': '#fbbf24',
    'assigned': '#60a5fa',
    'in_progress': '#3b82f6',
    'completed': '#22c55e',
    'resolved': '#34d399',
    'closed': '#6b7280',
    'rejected': '#ef4444',
  };

  const STATUS_LABELS: Record<string, string> = {
    'draft': 'Draft',
    'pending': 'Pending',
    'assigned': 'Assigned',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'rejected': 'Rejected',
  };

  return Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    count,
    color: STATUS_COLORS[status] || '#6b7280',
  }));
};

// Generate mock tickets for Moderator/Admin views (more comprehensive data)
export const generateMockTickets = (): Ticket[] => {
  const now = new Date();

  const mockTickets: Ticket[] = [
    // Pending Review > 24 hours
    {
      id: '1',
      ticketId: 'HD-2024-001',
      subject: 'Server downtime in Building A',
      description: 'Server has been down for 2 days, affecting multiple departments',
      department: 'IT',
      priority: 'urgent',
      status: 'pending',
      requestorId: 'req-1',
      requestorName: 'Ahmed Khan',
      submittedDate: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(), // 30 hours ago
    },
    {
      id: '2',
      ticketId: 'HD-2024-002',
      subject: 'AC not working in Conference Room',
      description: 'Air conditioning unit stopped working, room temperature is very high',
      department: 'Basic Maintenance',
      priority: 'high',
      status: 'submitted',
      requestorId: 'req-2',
      requestorName: 'Fatima Ali',
      submittedDate: new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString(), // 28 hours ago
    },
    {
      id: '3',
      ticketId: 'HD-2024-003',
      subject: 'Leakage in washroom',
      description: 'Water leakage from ceiling in 2nd floor washroom',
      department: 'Basic Maintenance',
      priority: 'high',
      status: 'pending',
      requestorId: 'req-3',
      requestorName: 'Hassan Raza',
      submittedDate: new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString(), // 50 hours ago
    },

    // SLA Breached Tickets
    {
      id: '4',
      ticketId: 'HD-2024-004',
      subject: 'Network connectivity issues',
      description: 'WiFi keeps disconnecting in entire floor',
      department: 'IT',
      priority: 'urgent',
      status: 'assigned',
      requestorId: 'req-4',
      requestorName: 'Sara Ahmed',
      assigneeId: 'assignee-1',
      assigneeName: 'IT Support Team',
      moderatorId: 'mod-1',
      moderatorName: 'Moderator User',
      submittedDate: new Date(now.getTime() - 80 * 60 * 60 * 1000).toISOString(), // 80 hours ago (breached)
      assignedDate: new Date(now.getTime() - 75 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      ticketId: 'HD-2024-005',
      subject: 'Printer not working',
      description: 'Main office printer is showing error and not printing',
      department: 'IT',
      priority: 'high',
      status: 'in_progress',
      requestorId: 'req-5',
      requestorName: 'Ali Hassan',
      assigneeId: 'assignee-2',
      assigneeName: 'IT Technician',
      submittedDate: new Date(now.getTime() - 90 * 60 * 60 * 1000).toISOString(), // 90 hours ago (breached)
      assignedDate: new Date(now.getTime() - 85 * 60 * 60 * 1000).toISOString(),
    },

    // SLA Approaching Tickets
    {
      id: '6',
      ticketId: 'HD-2024-006',
      subject: 'New employee onboarding',
      description: 'Need to set up workstation for new employee',
      department: 'Finance & Accounts',
      priority: 'medium',
      status: 'assigned',
      requestorId: 'req-6',
      requestorName: 'Zainab Malik',
      assigneeId: 'assignee-3',
      assigneeName: 'Finance & Accounts Team',
      submittedDate: new Date(now.getTime() - 65 * 60 * 60 * 1000).toISOString(), // 65 hours ago (approaching)
      assignedDate: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: '7',
      ticketId: 'HD-2024-007',
      subject: 'Purchase request for office supplies',
      description: 'Need to order stationery items for Q1',
      department: 'Procurement',
      priority: 'medium',
      status: 'in_progress',
      requestorId: 'req-7',
      requestorName: 'Bilal Khan',
      assigneeId: 'assignee-4',
      assigneeName: 'Procurement Officer',
      submittedDate: new Date(now.getTime() - 68 * 60 * 60 * 1000).toISOString(), // 68 hours ago (approaching)
      assignedDate: new Date(now.getTime() - 65 * 60 * 60 * 1000).toISOString(),
    },

    // Tickets Assigned Today
    {
      id: '8',
      ticketId: 'HD-2024-008',
      subject: 'Light bulb replacement',
      description: 'Multiple bulbs need replacement in corridor',
      department: 'Basic Maintenance',
      priority: 'medium',
      status: 'assigned',
      requestorId: 'req-8',
      requestorName: 'Nadia Sheikh',
      assigneeId: 'assignee-5',
      assigneeName: 'Electrician',
      moderatorId: 'mod-1',
      moderatorName: 'Moderator User',
      submittedDate: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (today)
    },
    {
      id: '9',
      ticketId: 'HD-2024-009',
      subject: 'Chair repair needed',
      description: 'Office chair wheel is broken',
      department: 'Basic Maintenance',
      priority: 'low',
      status: 'assigned',
      requestorId: 'req-9',
      requestorName: 'Omar Ali',
      assigneeId: 'assignee-6',
      assigneeName: 'Maintenance Team',
      submittedDate: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago (today)
    },
    {
      id: '10',
      ticketId: 'HD-2024-010',
      subject: 'Salary query',
      description: 'Need clarification on salary deduction',
      department: 'Finance & Accounts',
      priority: 'high',
      status: 'assigned',
      requestorId: 'req-10',
      requestorName: 'Ayesha Raza',
      assigneeId: 'assignee-7',
      assigneeName: 'Finance & Accounts Team',
      submittedDate: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago (today)
    },

    // Active Tickets (various departments)
    {
      id: '11',
      ticketId: 'HD-2024-011',
      subject: 'Software license renewal',
      description: 'Microsoft Office license expiring soon',
      department: 'IT',
      priority: 'high',
      status: 'in_progress',
      requestorId: 'req-11',
      requestorName: 'Kamran Malik',
      assigneeId: 'assignee-1',
      assigneeName: 'IT Support Team',
      submittedDate: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '12',
      ticketId: 'HD-2024-012',
      subject: 'Water cooler not working',
      description: 'Water dispenser stopped working',
      department: 'Basic Maintenance',
      priority: 'medium',
      status: 'assigned',
      requestorId: 'req-12',
      requestorName: 'Saima Khan',
      assigneeId: 'assignee-8',
      assigneeName: 'Plumber',
      submittedDate: new Date(now.getTime() - 15 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '13',
      ticketId: 'HD-2024-013',
      subject: 'Desk drawer stuck',
      description: 'Desk drawer in room 301 is stuck',
      department: 'Basic Maintenance',
      priority: 'low',
      status: 'in_progress',
      requestorId: 'req-13',
      requestorName: 'Tariq Hussain',
      assigneeId: 'assignee-6',
      assigneeName: 'Maintenance Team',
      submittedDate: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '14',
      ticketId: 'HD-2024-014',
      subject: 'Leave approval request',
      description: 'Need approval for 5 days leave',
      department: 'Finance & Accounts',
      priority: 'medium',
      status: 'pending',
      requestorId: 'req-14',
      requestorName: 'Farhan Ali',
      submittedDate: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '15',
      ticketId: 'HD-2024-015',
      subject: 'Invoice processing',
      description: 'Urgent invoice needs processing',
      department: 'Finance & Accounts',
      priority: 'high',
      status: 'in_progress',
      requestorId: 'req-15',
      requestorName: 'Hina Sheikh',
      assigneeId: 'assignee-7',
      assigneeName: 'Finance & Accounts Team',
      submittedDate: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 16 * 60 * 60 * 1000).toISOString(),
    },

    // Resolved Tickets (for average calculation)
    {
      id: '16',
      ticketId: 'HD-2024-016',
      subject: 'Email configuration',
      description: 'Need help setting up email client',
      department: 'IT',
      priority: 'medium',
      status: 'resolved',
      requestorId: 'req-16',
      requestorName: 'Usman Khan',
      assigneeId: 'assignee-1',
      assigneeName: 'IT Support Team',
      submittedDate: new Date(now.getTime() - 100 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 98 * 60 * 60 * 1000).toISOString(),
      completedDate: new Date(now.getTime() - 95 * 60 * 60 * 1000).toISOString(),
      resolvedDate: new Date(now.getTime() - 92 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '17',
      ticketId: 'HD-2024-017',
      subject: 'Phone extension setup',
      description: 'Need new phone extension',
      department: 'IT',
      priority: 'low',
      status: 'resolved',
      requestorId: 'req-17',
      requestorName: 'Amina Raza',
      assigneeId: 'assignee-1',
      assigneeName: 'IT Support Team',
      submittedDate: new Date(now.getTime() - 120 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 118 * 60 * 60 * 1000).toISOString(),
      completedDate: new Date(now.getTime() - 110 * 60 * 60 * 1000).toISOString(),
      resolvedDate: new Date(now.getTime() - 108 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '18',
      ticketId: 'HD-2024-018',
      subject: 'Door lock repair',
      description: 'Main entrance door lock is not working',
      department: 'Basic Maintenance',
      priority: 'high',
      status: 'resolved',
      requestorId: 'req-18',
      requestorName: 'Zubair Ahmed',
      assigneeId: 'assignee-6',
      assigneeName: 'Maintenance Team',
      submittedDate: new Date(now.getTime() - 150 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 148 * 60 * 60 * 1000).toISOString(),
      completedDate: new Date(now.getTime() - 140 * 60 * 60 * 1000).toISOString(),
      resolvedDate: new Date(now.getTime() - 138 * 60 * 60 * 1000).toISOString(),
    },

    // More active tickets for department distribution
    {
      id: '19',
      ticketId: 'HD-2024-019',
      subject: 'Cable management',
      description: 'Cables need proper organization',
      department: 'IT',
      priority: 'low',
      status: 'assigned',
      requestorId: 'req-19',
      requestorName: 'Rashid Ali',
      assigneeId: 'assignee-1',
      assigneeName: 'IT Support Team',
      submittedDate: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '20',
      ticketId: 'HD-2024-020',
      subject: 'Power socket installation',
      description: 'Need additional power socket in meeting room',
      department: 'Basic Maintenance',
      priority: 'medium',
      status: 'in_progress',
      requestorId: 'req-20',
      requestorName: 'Nida Malik',
      assigneeId: 'assignee-5',
      assigneeName: 'Electrician',
      submittedDate: new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return mockTickets;
};

// Generate mock tickets for reassignable tickets
export const generateMockReassignableTickets = (): Ticket[] => {
  const now = new Date();
  const departments = ['Development', 'Finance & Accounts', 'Procurement', 'Basic Maintenance', 'IT', 'Architecture', 'Administration'];
  const assignees = ['Ahmed Khan', 'Fatima Ali', 'Hassan Raza', 'Sara Ahmed', 'Ali Hassan', 'Zainab Malik', 'Bilal Khan', 'Nadia Sheikh'];
  const priorities: Ticket['priority'][] = ['low', 'medium', 'high', 'urgent'];
  const requestorNames = [
    'Ahmed Khan', 'Fatima Ali', 'Hassan Raza', 'Sara Ahmed', 'Ali Hassan',
    'Zainab Malik', 'Bilal Khan', 'Nadia Sheikh', 'Omar Ali', 'Ayesha Raza',
    'Kamran Malik', 'Saima Khan', 'Tariq Hussain', 'Farhan Ali', 'Hina Sheikh'
  ];
  const statuses: Ticket['status'][] = ['assigned', 'in_progress', 'pending'];

  const mockTickets: Ticket[] = [];

  for (let i = 1; i <= 15; i++) {
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const assignee = assignees[Math.floor(Math.random() * assignees.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const hoursAgo = Math.floor(Math.random() * 72);
    const requestorIndex = (i - 1) % requestorNames.length;

    mockTickets.push({
      id: `reassign-ticket-${i}`,
      ticketId: `HD-2024-${String(i).padStart(3, '0')}`,
      subject: `Reassignable Ticket ${i}: ${['Server Issue', 'Network Problem', 'Hardware Request', 'Software License', 'Maintenance Request'][Math.floor(Math.random() * 5)]}`,
      description: `This is a reassignable ticket description for ticket ${i}. It can be reassigned to a different department or assignee.`,
      department: dept,
      priority,
      status,
      requestorId: `req-${i}`,
      requestorName: requestorNames[requestorIndex],
      assigneeId: `assignee-${i}`,
      assigneeName: assignee,
      submittedDate: new Date(now.getTime() - (hoursAgo + 24) * 60 * 60 * 1000).toISOString(),
      assignedDate: status !== 'pending' ? new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString() : undefined,
    });
  }

  return mockTickets;
};

// Mock Employees Data
export interface MockEmployee {
  employee_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  department: {
    dept_code: string;
    dept_name: string;
  } | null;
  designation: {
    position_code: string;
    position_name: string;
  } | null;
  employment_type: string;
  employment_type_value: string;
  joining_date: string | null;
  resume_url?: string | null;
  created_at: string | null;
}

export const mockEmployees: MockEmployee[] = [
  {
    employee_id: '1',
    employee_code: 'EMP-001',
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    department: { dept_code: 'IT', dept_name: 'Information Technology' },
    designation: { position_code: 'DEV', position_name: 'Software Developer' },
    employment_type: 'Full-time',
    employment_type_value: 'full_time',
    joining_date: '2023-01-15',
    created_at: '2023-01-15T09:00:00Z',
  },
  {
    employee_id: '2',
    employee_code: 'EMP-002',
    full_name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+1987654321',
    department: { dept_code: 'HR', dept_name: 'Human Resources' },
    designation: { position_code: 'HRM', position_name: 'HR Manager' },
    employment_type: 'Full-time',
    employment_type_value: 'full_time',
    joining_date: '2022-05-20',
    created_at: '2022-05-20T09:00:00Z',
  },
  {
    employee_id: '3',
    employee_code: 'EMP-003',
    full_name: 'Robert Johnson',
    email: 'robert.johnson@example.com',
    phone: '+1122334455',
    department: { dept_code: 'FIN', dept_name: 'Finance' },
    designation: { position_code: 'ACC', position_name: 'Accountant' },
    employment_type: 'Contract',
    employment_type_value: 'contract',
    joining_date: '2023-08-01',
    created_at: '2023-08-01T09:00:00Z',
  },
  {
    employee_id: '4',
    employee_code: 'EMP-004',
    full_name: 'Emily Davis',
    email: 'emily.davis@example.com',
    phone: '+1555666777',
    department: { dept_code: 'MKT', dept_name: 'Marketing' },
    designation: { position_code: 'MKT_EXE', position_name: 'Marketing Executive' },
    employment_type: 'Part-time',
    employment_type_value: 'part_time',
    joining_date: '2023-11-10',
    created_at: '2023-11-10T09:00:00Z',
  },
  {
    employee_id: '5',
    employee_code: 'EMP-005',
    full_name: 'Michael Wilson',
    email: 'michael.wilson@example.com',
    phone: '+1999888777',
    department: { dept_code: 'IT', dept_name: 'Information Technology' },
    designation: { position_code: 'SYS_ADMIN', position_name: 'System Administrator' },
    employment_type: 'Full-time',
    employment_type_value: 'full_time',
    joining_date: '2021-03-15',
    resume_url: null,
    created_at: '2021-03-15T09:00:00Z',
  },
];

export const getMockEmployees = (): MockEmployee[] => {
  return mockEmployees;
};

export const getMockEmployeeById = (id: string): MockEmployee | undefined => {
  return mockEmployees.find(emp => emp.employee_id === id);
};

// Mock Departments
export interface MockDepartment {
  dept_id: string;
  dept_code: string;
  dept_name: string;
  sector: string;
  description: string;
}

export const mockDepartments: MockDepartment[] = [
  { dept_id: '1', dept_code: 'IT', dept_name: 'Information Technology', sector: 'Information Technology', description: 'IT infrastructure and support' },
  { dept_id: '2', dept_code: 'HR', dept_name: 'Human Resources', sector: 'Administration', description: 'Employee management and relations' },
  { dept_id: '3', dept_code: 'FIN', dept_name: 'Finance & Accounts', sector: 'Finance', description: 'Financial planning and accounting' },
  { dept_id: '4', dept_code: 'MKT', dept_name: 'Marketing', sector: 'Marketing', description: 'Brand management and advertising' },
  { dept_id: '5', dept_code: 'OPS', dept_name: 'Operations', sector: 'Operations', description: 'Daily business operations' },
  { dept_id: '6', dept_code: 'DEV', dept_name: 'Development', sector: 'Information Technology', description: 'Software development and engineering' },
  { dept_id: '7', dept_code: 'PROC', dept_name: 'Procurement', sector: 'Procurement', description: 'Purchasing and vendor management' },
  { dept_id: '8', dept_code: 'MAINT', dept_name: 'Basic Maintenance', sector: 'Maintenance', description: 'General facility maintenance' },
];

export const getMockDepartments = () => mockDepartments;

export const getMockDepartmentById = (id: string) => mockDepartments.find(d => d.dept_id === id || d.dept_code === id);

// Mock Designations
export interface MockDesignation {
  position_code: string;
  position_name: string;
  dept_code: string;
}

export const mockDesignations: MockDesignation[] = [
  { position_code: 'DEV', position_name: 'Software Developer', dept_code: 'DEV' },
  { position_code: 'SNR_DEV', position_name: 'Senior Developer', dept_code: 'DEV' },
  { position_code: 'QA', position_name: 'QA Engineer', dept_code: 'DEV' },
  { position_code: 'HRM', position_name: 'HR Manager', dept_code: 'HR' },
  { position_code: 'REC', position_name: 'Recruiter', dept_code: 'HR' },
  { position_code: 'ACC', position_name: 'Accountant', dept_code: 'FIN' },
  { position_code: 'FIN_MGR', position_name: 'Finance Manager', dept_code: 'FIN' },
  { position_code: 'MKT_EXE', position_name: 'Marketing Executive', dept_code: 'MKT' },
  { position_code: 'SYS_ADMIN', position_name: 'System Administrator', dept_code: 'IT' },
  { position_code: 'NET_ENG', position_name: 'Network Engineer', dept_code: 'IT' },
  { position_code: 'OPS_MGR', position_name: 'Operations Manager', dept_code: 'OPS' },
  { position_code: 'PROC_OFF', position_name: 'Procurement Officer', dept_code: 'PROC' },
  { position_code: 'TECH', position_name: 'Technician', dept_code: 'MAINT' },
];

export const getMockDesignations = () => mockDesignations;

export const getMockDesignationsByDept = (deptCode: string) => mockDesignations.filter(d => d.dept_code === deptCode);
