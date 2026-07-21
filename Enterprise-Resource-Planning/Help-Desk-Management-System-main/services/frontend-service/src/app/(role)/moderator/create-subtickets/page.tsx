'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { TextArea } from '../../../../components/ui/TextArea';
import { Select, SelectOption } from '../../../../components/ui/Select';
import { StatusBadge } from '../../../../components/common/StatusBadge';
import { PriorityBadge } from '../../../../components/common/PriorityBadge';
import { THEME } from '../../../../lib/theme';
import { Ticket } from '../../../../types';
import { formatDate } from '../../../../lib/helpers';
import ticketService from '../../../../services/api/ticketService';
import userService from '../../../../services/api/userService';
import { DEPARTMENTS } from '../../../../lib/constants';
import {
  ArrowLeft,
  Plus,
  Trash2,
  XCircle,
  FileText,
  AlertCircle,
  CheckCircle,
  Users,
  Calendar,
  User
} from 'lucide-react';
import AlertModal from '../../../../components/modals/AlertModal';

interface SubticketForm {
  id: string; // Unique ID for each form
  subject: string;
  description: string;
  department: string;
  assigneeId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  slaOverride?: string; // Optional SLA override
}

// Mock data generator
const generateMockParentTicket = (ticketId: string): Ticket => {
  return {
    id: ticketId,
    ticketId: `HD-2024-${String(ticketId).padStart(3, '0')}`,
    subject: 'Sample Parent Ticket for Subtickets',
    description: 'This is a parent ticket that needs to be split into multiple sub-tickets for different departments.',
    department: 'IT',
    priority: 'high',
    status: 'submitted',
    requestorId: 'req-1',
    requestorName: 'Ahmed Khan',
    submittedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  };
};

// Mock assignees by department
const getMockAssignees = (department: string): Array<{ id: string; name: string; department: string }> => {
  const mockAssignees: Record<string, Array<{ id: string; name: string; department: string }>> = {
    'Development': [
      { id: 'assignee-dev-1', name: 'Ahmed Khan', department: 'Development' },
      { id: 'assignee-dev-2', name: 'Fatima Ali', department: 'Development' },
      { id: 'assignee-dev-3', name: 'Hassan Raza', department: 'Development' },
    ],
    'Finance & Accounts': [
      { id: 'assignee-fin-1', name: 'Zainab Malik', department: 'Finance & Accounts' },
      { id: 'assignee-fin-2', name: 'Bilal Khan', department: 'Finance & Accounts' },
    ],
    'Procurement': [
      { id: 'assignee-proc-1', name: 'Nadia Sheikh', department: 'Procurement' },
      { id: 'assignee-proc-2', name: 'Kamran Malik', department: 'Procurement' },
    ],
    'Basic Maintenance': [
      { id: 'assignee-maint-1', name: 'Omar Ali', department: 'Basic Maintenance' },
      { id: 'assignee-maint-2', name: 'Ayesha Raza', department: 'Basic Maintenance' },
      { id: 'assignee-maint-3', name: 'Saima Khan', department: 'Basic Maintenance' },
    ],
    'IT': [
      { id: 'assignee-it-1', name: 'Ahmed Khan', department: 'IT' },
      { id: 'assignee-it-2', name: 'Fatima Ali', department: 'IT' },
      { id: 'assignee-it-3', name: 'Hassan Raza', department: 'IT' },
    ],
    'Architecture': [
      { id: 'assignee-arch-1', name: 'Zara Khan', department: 'Architecture' },
      { id: 'assignee-arch-2', name: 'Faisal Ali', department: 'Architecture' },
    ],
    'Administration': [
      { id: 'assignee-admin-1', name: 'Rashid Malik', department: 'Administration' },
      { id: 'assignee-admin-2', name: 'Sana Ahmed', department: 'Administration' },
    ],
  };

  return mockAssignees[department] || [{ id: `assignee-${department}-1`, name: `${department} Head`, department }];
};

const CreateSubticketsPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const parentTicketId = searchParams.get('parent');

  const [parentTicket, setParentTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [useMockData, setUseMockData] = useState(false);
  const [subticketForms, setSubticketForms] = useState<SubticketForm[]>([
    {
      id: `form-${Date.now()}`,
      subject: '',
      description: '',
      department: '',
      assigneeId: '',
      priority: 'medium',
    }
  ]);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [departmentAssignees, setDepartmentAssignees] = useState<Record<string, Array<{ id: string; name: string; department: string }>>>({});
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    details?: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  // Fetch parent ticket
  useEffect(() => {
    const fetchParentTicket = async () => {
      if (!parentTicketId) {
        setLoading(false);
        return;
      }

      try {
        const ticket = await ticketService.getTicketById(parentTicketId);
        setParentTicket(ticket);
        setUseMockData(false);

        // Initialize first form with parent department
        setSubticketForms([{
          id: `form-${Date.now()}`,
          subject: '',
          description: '',
          department: ticket.department,
          assigneeId: '',
          priority: ticket.priority || 'medium',
        }]);
      } catch (error: any) {
        const isNetworkError = error?.isNetworkError || !error?.response;
        if (isNetworkError) {
          console.warn('API not available, using mock data');
          const mockTicket = generateMockParentTicket(parentTicketId);
          setParentTicket(mockTicket);
          setUseMockData(true);

          setSubticketForms([{
            id: `form-${Date.now()}`,
            subject: '',
            description: '',
            department: mockTicket.department,
            assigneeId: '',
            priority: mockTicket.priority || 'medium',
          }]);
        } else {
          console.error('Error fetching parent ticket:', error);
          setAlertModal({
            isOpen: true,
            type: 'error',
            title: 'Error Loading Ticket',
            message: 'Failed to load parent ticket.',
            details: error?.message || 'Please try again or go back to ticket pool.',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchParentTicket();
  }, [parentTicketId]);

  // Fetch assignees (or use mock)
  useEffect(() => {
    const fetchAssignees = async () => {
      try {
        const response = await userService.getUsers({ role: 'assignee' });
        const usersList = Array.isArray(response) ? response : (response?.results || []);

        // Group by department
        const grouped: Record<string, Array<{ id: string; name: string; department: string }>> = {};
        usersList.forEach((user: any) => {
          if (user.department) {
            if (!grouped[user.department]) {
              grouped[user.department] = [];
            }
            grouped[user.department].push({
              id: user.id,
              name: user.name,
              department: user.department,
            });
          }
        });
        setDepartmentAssignees(grouped);
      } catch (error: any) {
        // Use mock assignees
        const mockGrouped: Record<string, Array<{ id: string; name: string; department: string }>> = {};
        DEPARTMENTS.forEach(dept => {
          mockGrouped[dept] = getMockAssignees(dept);
        });
        setDepartmentAssignees(mockGrouped);
      }
    };

    fetchAssignees();
  }, []);

  // Department options
  const departmentOptions: SelectOption[] = DEPARTMENTS.map(dept => ({
    value: dept,
    label: dept,
  }));

  // Priority options
  const priorityOptions: SelectOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  // Get assignees for a department
  const getAssigneesForDepartment = (department: string): SelectOption[] => {
    const assignees = departmentAssignees[department] || [];
    return [
      { value: '', label: 'Auto-assign to department head' },
      ...assignees.map(a => ({
        value: a.id,
        label: a.name,
      }))
    ];
  };

  // Add new subticket form
  const handleAddSubticket = () => {
    setSubticketForms(prev => [...prev, {
      id: `form-${Date.now()}-${Math.random()}`,
      subject: '',
      description: '',
      department: parentTicket?.department || DEPARTMENTS[0],
      assigneeId: '',
      priority: 'medium',
    }]);
  };

  // Remove subticket form
  const handleRemoveSubticket = (formId: string) => {
    if (subticketForms.length === 1) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Cannot Remove',
        message: 'At least one sub-ticket form is required.',
      });
      return;
    }

    setSubticketForms(prev => prev.filter(form => form.id !== formId));
    // Clear errors for removed form
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[formId];
      return newErrors;
    });
  };

  // Update subticket form field
  const updateSubticketForm = (formId: string, field: keyof SubticketForm, value: any) => {
    setSubticketForms(prev => prev.map(form => {
      if (form.id === formId) {
        const updated = { ...form, [field]: value };
        // Clear assignee if department changes
        if (field === 'department' && value !== form.department) {
          updated.assigneeId = '';
        }
        return updated;
      }
      return form;
    }));

    // Clear error for this field
    if (errors[formId]?.[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[formId]) {
          newErrors[formId] = { ...newErrors[formId], [field]: '' };
        }
        return newErrors;
      });
    }
  };

  // Validate all forms
  const validateForms = (): boolean => {
    const newErrors: Record<string, Record<string, string>> = {};
    let hasErrors = false;
    const usedDepartments = new Set<string>();

    subticketForms.forEach((form, index) => {
      const formErrors: Record<string, string> = {};

      // Validate subject
      if (!form.subject.trim()) {
        formErrors.subject = 'Subject is required';
        hasErrors = true;
      } else if (form.subject.trim().length < 5) {
        formErrors.subject = 'Subject must be at least 5 characters';
        hasErrors = true;
      }

      // Validate description
      if (!form.description.trim()) {
        formErrors.description = 'Description is required';
        hasErrors = true;
      } else if (form.description.trim().length < 10) {
        formErrors.description = 'Description must be at least 10 characters';
        hasErrors = true;
      }

      // Validate department
      if (!form.department) {
        formErrors.department = 'Department is required';
        hasErrors = true;
      } else if (usedDepartments.has(form.department)) {
        formErrors.department = 'This department is already used in another sub-ticket';
        hasErrors = true;
      } else {
        usedDepartments.add(form.department);
      }

      // Validate assignee (optional but recommended)
      // if (!form.assigneeId) {
      //   formErrors.assigneeId = 'Assignee is required';
      //   hasErrors = true;
      // }

      if (Object.keys(formErrors).length > 0) {
        newErrors[form.id] = formErrors;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  // Handle create subtickets
  const handleCreateSubtickets = async () => {
    if (!parentTicket) return;

    if (!validateForms()) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix all errors before creating sub-tickets.',
        details: 'Check all required fields and ensure no duplicate departments.',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Prepare subtickets data
      const subticketsData = subticketForms.map(form => ({
        subject: form.subject.trim(),
        description: form.description.trim(),
        department: form.department,
        priority: form.priority,
      }));

      // Call API to create subtickets
      try {
        await ticketService.splitTicket(parentTicket.id, subticketsData);

        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Sub-Tickets Created Successfully!',
          message: `${subticketForms.length} sub-ticket${subticketForms.length > 1 ? 's' : ''} created successfully.`,
          details: `Parent Ticket: ${parentTicket.ticketId}\nSub-tickets will automatically join the parent ticket chat.`,
        });
      } catch (splitError: any) {
        const isNetworkError = splitError?.isNetworkError || !splitError?.response;

        if (isNetworkError) {
          // Demo mode - simulate success
          console.warn('API not available, simulating subticket creation (Demo Mode)');

          setAlertModal({
            isOpen: true,
            type: 'info',
            title: 'Sub-Tickets Created (Demo Mode)',
            message: `${subticketForms.length} sub-ticket${subticketForms.length > 1 ? 's' : ''} created in demo mode.`,
            details: `Parent Ticket: ${parentTicket.ticketId}\n\nCreated Sub-tickets:\n${subticketForms.map((f, i) => `${i + 1}. ${f.subject} (${f.department})`).join('\n')}\n\nNote: API not available, this is a demo action.`,
          });
        } else {
          throw splitError;
        }
      }
    } catch (error: any) {
      console.error('Error creating subtickets:', error);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Failed to Create Sub-Tickets',
        message: 'An error occurred while creating sub-tickets.',
        details: error?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (subticketForms.some(f => f.subject || f.description)) {
      if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
        router.push(parentTicketId ? `/moderator/ticket/${parentTicketId}` : '/moderator/ticket-pool');
      }
    } else {
      router.push(parentTicketId ? `/moderator/ticket/${parentTicketId}` : '/moderator/ticket-pool');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 flex items-center justify-center" style={{ backgroundColor: THEME.colors.background }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!parentTicketId) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ backgroundColor: THEME.colors.background }}>
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Parent Ticket Selected</h3>
            <p className="text-gray-500 mb-6">
              Please select a parent ticket from the Ticket Pool to create sub-tickets.
            </p>
            <Button variant="primary" onClick={() => router.push('/moderator/ticket-pool')}>
              Go to Ticket Pool
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!parentTicket) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ backgroundColor: THEME.colors.background }}>
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Parent Ticket Not Found</h3>
            <p className="text-gray-500 mb-6">
              The parent ticket could not be loaded.
            </p>
            <Button variant="primary" onClick={() => router.push('/moderator/ticket-pool')}>
              Go to Ticket Pool
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ backgroundColor: THEME.colors.background }}>
      {/* Mock Data Indicator */}
      {useMockData && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            <strong>Demo Mode:</strong> Showing mock data for demonstration purposes
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => router.push(`/moderator/ticket/${parentTicketId}`)}
          className="mb-4"
        >
          Back
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
            Create Sub-Tickets
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Split the parent ticket into multiple sub-tickets for different departments
          </p>
        </div>
      </div>

      {/* Parent Ticket Info Card */}
      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl font-bold" style={{ color: THEME.colors.primary }}>
            Parent Ticket Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Ticket ID</p>
              <p className="text-base font-semibold" style={{ color: THEME.colors.primary }}>
                {parentTicket.ticketId}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <StatusBadge status={parentTicket.status} />
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mb-1">Subject</p>
              <p className="text-base font-medium text-gray-900">{parentTicket.subject}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Department</p>
              <p className="text-sm text-gray-700">{parentTicket.department}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Priority</p>
              {parentTicket.priority && <PriorityBadge priority={parentTicket.priority} />}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">requestor</p>
              <p className="text-sm text-gray-700">{parentTicket.requestorName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Submitted</p>
              <p className="text-sm text-gray-700">{formatDate(parentTicket.submittedDate, 'long')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-Ticket Forms */}
      <div className="space-y-6">
        {subticketForms.map((form, index) => (
          <Card key={form.id} className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold" style={{ color: THEME.colors.primary }}>
                  Sub-Ticket {index + 1}
                </CardTitle>
                {subticketForms.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSubticket(form.id)}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Input
                  label="Title *"
                  placeholder="Enter sub-ticket title..."
                  value={form.subject}
                  onChange={(e) => updateSubticketForm(form.id, 'subject', e.target.value)}
                  error={errors[form.id]?.subject}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <TextArea
                  label="Description *"
                  placeholder="Enter detailed description for this sub-ticket..."
                  value={form.description}
                  onChange={(e) => updateSubticketForm(form.id, 'description', e.target.value)}
                  rows={4}
                  error={errors[form.id]?.description}
                  required
                />
              </div>

              {/* Department and Priority Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Select
                    label="Department *"
                    options={departmentOptions}
                    value={form.department}
                    onChange={(value) => updateSubticketForm(form.id, 'department', value)}
                    error={errors[form.id]?.department}
                    fullWidth
                  />
                  {errors[form.id]?.department && (
                    <p className="text-xs text-red-600 mt-1">{errors[form.id].department}</p>
                  )}
                </div>

                <div>
                  <Select
                    label="Priority *"
                    options={priorityOptions}
                    value={form.priority}
                    onChange={(value) => updateSubticketForm(form.id, 'priority', value as any)}
                    fullWidth
                  />
                </div>
              </div>

              {/* Assignee */}
              <div>
                <Select
                  label="Assignee"
                  options={getAssigneesForDepartment(form.department)}
                  value={form.assigneeId}
                  onChange={(value) => updateSubticketForm(form.id, 'assigneeId', value)}
                  fullWidth
                  disabled={!form.department}
                />
                {!form.department && (
                  <p className="text-xs text-gray-500 mt-1">Please select a department first</p>
                )}
              </div>

              {/* SLA Override (Optional) */}
              <div>
                <Input
                  label="SLA Override (Due Date) - Optional"
                  type="datetime-local"
                  value={form.slaOverride || ''}
                  onChange={(e) => updateSubticketForm(form.id, 'slaOverride', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Another Sub-Ticket Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleAddSubticket}
          >
            Add Another Sub-Ticket
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateSubtickets}
            loading={submitting}
            disabled={submitting}
            leftIcon={<CheckCircle className="w-4 h-4" />}
          >
            Create Sub-Tickets ({subticketForms.length})
          </Button>
        </div>
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          // Redirect on success
          if (alertModal.type === 'success' || alertModal.type === 'info') {
            setTimeout(() => {
              router.push(`/moderator/ticket/${parentTicketId}`);
            }, 1000);
          }
        }}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        details={alertModal.details}
        buttonText="OK"
      />
    </div>
  );
};

export default CreateSubticketsPage;
