'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { AnalyticsCard } from '../../../../components/common/AnalyticsCard';
import { TicketVolumeChart } from '../../../../components/charts/TicketVolumeChart';
import { DepartmentLoadChart } from '../../../../components/charts/DepartmentLoadChart';
import { ResolutionTimeTrendChart } from '../../../../components/charts/ResolutionTimeTrendChart';
import { PriorityDistributionChart } from '../../../../components/charts/PriorityDistributionChart';
import { StatusDistributionChart } from '../../../../components/charts/StatusDistributionChart';
import { THEME } from '../../../../lib/theme';
import ticketService from '../../../../services/api/ticketService';
import { Ticket } from '../../../../types';
import { formatDate } from '../../../../lib/helpers';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Gauge
} from 'lucide-react';
import { PageContainer } from '../../../../components/layout/PageContainer';

// SLA Compliance Gauge Chart Component
const SLAComplianceGauge: React.FC<{ value: number; height?: number }> = ({ value, height = 200 }) => {
  const percentage = Math.min(100, Math.max(0, value));
  const color = percentage >= 90 ? '#22c55e' : percentage >= 70 ? '#fbbf24' : '#ef4444';

  return (
    <div className="flex flex-col items-center justify-center" style={{ height }}>
      <div className="relative w-48 h-48">
        <svg className="transform -rotate-90" width="192" height="192">
          <circle
            cx="96"
            cy="96"
            r="80"
            stroke="#e5e7eb"
            strokeWidth="16"
            fill="none"
          />
          <circle
            cx="96"
            cy="96"
            r="80"
            stroke={color}
            strokeWidth="16"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 80}`}
            strokeDashoffset={`${2 * Math.PI * 80 * (1 - percentage / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold" style={{ color }}>
              {percentage}%
            </div>
            <div className="text-sm" style={{ color: THEME.colors.gray }}>
              SLA Compliance
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminAnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        setError(null);
        try {
          const response = await ticketService.getTickets();
          const ticketsList = Array.isArray(response)
            ? response
            : (response?.results || []);
          setTickets(ticketsList.length > 0 ? ticketsList : generateDemoTickets());
        } catch (error: any) {
          const isNetworkError = error?.isNetworkError || !error?.response;
          if (isNetworkError) {
            console.warn('API not available, using demo data');
            setTickets(generateDemoTickets());
          } else {
            throw error;
          }
        }
      } catch (error: any) {
        console.error('Error fetching tickets:', error);
        setError('Failed to load analytics data');
        setTickets(generateDemoTickets());
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  // Generate demo tickets
  function generateDemoTickets(): Ticket[] {
    const now = new Date();
    return Array.from({ length: 200 }, (_, i) => ({
      id: `ticket-${i + 1}`,
      ticketId: `TKT-${String(i + 1).padStart(3, '0')}`,
      subject: `Sample Ticket ${i + 1}`,
      description: `Description for ticket ${i + 1}`,
      department: ['Development', 'Finance & Accounts', 'Procurement', 'Basic Maintenance', 'IT', 'Architecture', 'Administration'][i % 7],
      priority: ['low', 'medium', 'high', 'urgent'][i % 4] as any,
      status: ['assigned', 'in_progress', 'resolved', 'completed', 'pending'][i % 5] as any,
      requestorId: `req-${i + 1}`,
      requestorName: `User ${i + 1}`,
      submittedDate: new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      assignedDate: new Date(now.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      ...(i % 3 === 0 && {
        completedDate: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedDate: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    }));
  }

  // Filter tickets by date range
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const ticketDate = new Date(t.submittedDate);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      return ticketDate >= startDate && ticketDate <= endDate;
    });
  }, [tickets, dateRange]);

  // Calculate KPIs
  const totalTickets = filteredTickets.length;
  const resolvedTickets = filteredTickets.filter(t =>
    ['resolved', 'completed', 'closed'].includes(t.status)
  ).length;
  const avgResolutionTime = useMemo(() => {
    const completed = filteredTickets.filter(t => t.resolvedDate || t.completedDate);
    if (completed.length === 0) return 0;
    const totalDays = completed.reduce((sum, t) => {
      const resolvedDate = new Date(t.resolvedDate || t.completedDate || '');
      const createdDate = new Date(t.submittedDate);
      return sum + (resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    return totalDays / completed.length;
  }, [filteredTickets]);

  const slaCompliance = useMemo(() => {
    const completed = filteredTickets.filter(t => t.resolvedDate || t.completedDate);
    if (completed.length === 0) return 100;
    const withinSLA = completed.filter(t => {
      const resolvedDate = new Date(t.resolvedDate || t.completedDate || '');
      const createdDate = new Date(t.submittedDate);
      const daysToResolve = (resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      const slaDays = t.priority === 'urgent' || t.priority === 'high' ? 7 : t.priority === 'medium' ? 14 : 30;
      return daysToResolve <= slaDays;
    }).length;
    return Math.round((withinSLA / completed.length) * 100);
  }, [filteredTickets]);

  // Chart data
  const ticketVolumeData = useMemo(() => {
    const days = Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24));
    const data = [];
    const startDate = new Date(dateRange.start);

    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const dayTickets = filteredTickets.filter(t => {
        const ticketDate = new Date(t.submittedDate);
        return ticketDate.toDateString() === date.toDateString();
      });

      const created = dayTickets.length;
      const resolved = dayTickets.filter(t =>
        t.resolvedDate && new Date(t.resolvedDate).toDateString() === date.toDateString()
      ).length;

      data.push({ date: dateStr, created, resolved });
    }

    return data;
  }, [filteredTickets, dateRange]);

  const departmentWorkloadData = useMemo(() => {
    const departments = Array.from(new Set(filteredTickets.map(t => t.department).filter(Boolean)));
    return departments.map(dept => {
      const deptTickets = filteredTickets.filter(t => t.department === dept);
      return {
        department: dept,
        assigned: deptTickets.length,
        completed: deptTickets.filter(t => t.status === 'resolved' || t.status === 'completed').length,
        pending: deptTickets.filter(t => t.status === 'assigned' || t.status === 'pending').length,
      };
    });
  }, [filteredTickets]);

  const resolutionTimeData = useMemo(() => {
    const days = Math.min(30, Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)));
    const data = [];
    const startDate = new Date(dateRange.start);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const completedTickets = filteredTickets.filter(t => {
        if (t.resolvedDate || t.completedDate) {
          const resolvedDate = new Date(t.resolvedDate || t.completedDate || '');
          return resolvedDate.toDateString() === date.toDateString();
        }
        return false;
      });

      const avgDays = completedTickets.length > 0
        ? completedTickets.reduce((sum, t) => {
          const resolvedDate = new Date(t.resolvedDate || t.completedDate || '');
          const createdDate = new Date(t.submittedDate);
          const diffDays = (resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          return sum + diffDays;
        }, 0) / completedTickets.length
        : 0;

      data.push({ date: dateStr, averageDays: Math.round(avgDays * 10) / 10 || 0 });
    }

    return data;
  }, [filteredTickets, dateRange]);

  const priorityDistributionData = useMemo(() => {
    const priorityCounts: Record<string, number> = {};
    filteredTickets.forEach(t => {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    });

    const colors: Record<string, string> = {
      urgent: '#ef4444',
      high: '#f97316',
      medium: '#fbbf24',
      low: '#34d399',
    };

    return Object.entries(priorityCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name] || '#9ca3af',
    }));
  }, [filteredTickets]);

  const statusDistributionData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const status = t.status.charAt(0).toUpperCase() + t.status.slice(1).replace('_', ' ');
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const colors: Record<string, string> = {
      'Assigned': '#60a5fa',
      'Pending': '#fbbf24',
      'In progress': '#3b82f6',
      'Resolved': '#34d399',
      'Completed': '#22c55e',
      'Closed': '#6b7280',
    };

    return Object.entries(statusCounts).map(([name, count]) => ({
      name,
      count,
      color: colors[name] || '#9ca3af',
    }));
  }, [filteredTickets]);

  // Reports data
  const departmentPerformanceReport = useMemo(() => {
    const departments = Array.from(new Set(filteredTickets.map(t => t.department).filter(Boolean)));
    return departments.map(dept => {
      const deptTickets = filteredTickets.filter(t => t.department === dept);
      const completed = deptTickets.filter(t => t.status === 'resolved' || t.status === 'completed').length;
      const avgTime = deptTickets.filter(t => t.resolvedDate || t.completedDate).reduce((sum, t) => {
        const resolvedDate = new Date(t.resolvedDate || t.completedDate || '');
        const createdDate = new Date(t.submittedDate);
        return sum + (resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / (completed || 1);

      return {
        department: dept,
        totalTickets: deptTickets.length,
        completed,
        pending: deptTickets.length - completed,
        avgResolutionTime: Math.round(avgTime * 10) / 10,
        completionRate: deptTickets.length > 0 ? Math.round((completed / deptTickets.length) * 100) : 0,
      };
    });
  }, [filteredTickets]);

  const handleExportReport = (type: string) => {
    // In real implementation, this would generate and download a CSV/PDF
    alert(`Exporting ${type} report...`);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-screen" style={{ backgroundColor: THEME.colors.background }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
          <p style={{ color: THEME.colors.gray }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <PageContainer className="space-y-4 md:space-y-6">
      {/* Page Header */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
                System Analytics
              </h1>
              <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                Comprehensive insights into ticket management and system performance
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm"
                  style={{ borderColor: THEME.colors.background }}
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm"
                  style={{ borderColor: THEME.colors.background }}
                />
              </div>
              <Button
                variant="primary"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => handleExportReport('full')}
              >
                <span className="hidden sm:inline">Export Report</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
        <div className="h-full">
          <AnalyticsCard
            title="Total Tickets"
            value={totalTickets}
            icon={BarChart3}
            color={THEME.colors.primary}
            hoverDescription="Tickets in selected period"
          />
        </div>
        <div className="h-full">
          <AnalyticsCard
            title="Resolved Tickets"
            value={resolvedTickets}
            icon={CheckCircle}
            color={THEME.colors.success}
            hoverDescription="Completed in selected period"
          />
        </div>
        <div className="h-full">
          <AnalyticsCard
            title="Avg Resolution Time"
            value={avgResolutionTime > 0 ? `${Math.round(avgResolutionTime)} days` : 'N/A'}
            icon={Clock}
            color={THEME.colors.medium}
            hoverDescription="Average days to resolve"
          />
        </div>
        <div className="h-full">
          <AnalyticsCard
            title="SLA Compliance"
            value={`${slaCompliance}%`}
            icon={Gauge}
            color={slaCompliance >= 90 ? THEME.colors.success : slaCompliance >= 70 ? THEME.colors.warning : THEME.colors.error}
            hoverDescription="Tickets resolved within SLA"
          />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Ticket Volume Chart */}
        <Card className="bg-white rounded-2xl shadow-xl border-0">
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
            <CardTitle className="text-lg md:text-xl font-bold" style={{ color: THEME.colors.primary }}>
              Ticket Volume Over Time
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 md:pt-4">
            <TicketVolumeChart data={ticketVolumeData} height={250} />
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="bg-white rounded-2xl shadow-xl border-0">
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
            <CardTitle className="text-lg md:text-xl font-bold" style={{ color: THEME.colors.primary }}>
              Department Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 md:pt-4">
            <DepartmentLoadChart data={departmentWorkloadData} height={250} />
          </CardContent>
        </Card>

        {/* Resolution Time Trends */}
        <Card className="bg-white rounded-2xl shadow-xl border-0">
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
            <CardTitle className="text-lg md:text-xl font-bold" style={{ color: THEME.colors.primary }}>
              Resolution Time Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 md:pt-4">
            <ResolutionTimeTrendChart data={resolutionTimeData} height={250} />
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card className="bg-white rounded-2xl shadow-xl border-0">
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
            <CardTitle className="text-lg md:text-xl font-bold" style={{ color: THEME.colors.primary }}>
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 md:pt-4">
            <PriorityDistributionChart data={priorityDistributionData} height={250} />
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="bg-white rounded-2xl shadow-xl border-0">
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
            <CardTitle className="text-lg md:text-xl font-bold" style={{ color: THEME.colors.primary }}>
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 md:pt-4">
            <StatusDistributionChart data={statusDistributionData} height={250} />
          </CardContent>
        </Card>

        {/* SLA Compliance Gauge */}
        <Card className="bg-white rounded-2xl shadow-xl border-0">
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
            <CardTitle className="text-lg md:text-xl font-bold" style={{ color: THEME.colors.primary }}>
              SLA Compliance Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-2 md:pt-4">
            <SLAComplianceGauge value={slaCompliance} height={250} />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardHeader className="p-4 md:p-6 lg:p-8 pb-2 md:pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-lg md:text-xl lg:text-2xl font-bold" style={{ color: THEME.colors.primary }}>
              Detailed Reports
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-3 h-3" />}
                onClick={() => handleExportReport('department')}
              >
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4">
          <div className="space-y-6">
            {/* Department Performance Report */}
            <div>
              <h3 className="text-lg font-bold mb-4" style={{ color: THEME.colors.primary }}>
                Department Performance Report
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2" style={{ borderColor: THEME.colors.background }}>
                      <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Department</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Total Tickets</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Completed</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Pending</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Avg Resolution (Days)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentPerformanceReport.map((dept, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50" style={{ borderColor: THEME.colors.background }}>
                        <td className="py-4 px-4 font-medium" style={{ color: THEME.colors.primary }}>{dept.department}</td>
                        <td className="py-4 px-4" style={{ color: THEME.colors.gray }}>{dept.totalTickets}</td>
                        <td className="py-4 px-4" style={{ color: THEME.colors.gray }}>{dept.completed}</td>
                        <td className="py-4 px-4" style={{ color: THEME.colors.gray }}>{dept.pending}</td>
                        <td className="py-4 px-4" style={{ color: THEME.colors.gray }}>{dept.avgResolutionTime}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 rounded text-xs font-medium" style={{
                            backgroundColor: dept.completionRate >= 80 ? '#D1FAE5' : dept.completionRate >= 60 ? '#FEF3C7' : '#FEE2E2',
                            color: dept.completionRate >= 80 ? '#065F46' : dept.completionRate >= 60 ? '#92400E' : '#991B1B',
                          }}>
                            {dept.completionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">
            {error} - Showing demo data for demonstration purposes.
          </p>
        </div>
      )}
    </PageContainer>
  );
};

export default AdminAnalyticsPage;

