'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { useTicketActions } from '../../../../hooks/useTicketActions';
import { Card, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { TextArea } from '../../../../components/ui/TextArea';
import { Select, SelectOption } from '../../../../components/ui/Select';
import { PriorityBadge } from '../../../../components/common/PriorityBadge';
import { FileUpload, FileWithStatus } from '../../../../components/common/FileUpload';
import { THEME } from '../../../../lib/theme';
import {
  validateTicketSubject,
  validateTicketDescription,
  validateRequired
} from '../../../../lib/validation';
import { TICKET_PRIORITY, DEPARTMENTS } from '../../../../lib/constants';
import { ticketService } from '../../../../services/api/ticketService';
import { fileService } from '../../../../services/api/fileService';
import { departmentService, Department } from '../../../../services/api/departmentService';
import { apiClient } from '../../../../services/api/axiosClient';
import { ENV } from '../../../../config/env';
import { AlertCircle, Save, CheckCircle } from 'lucide-react';
import { PageContainer } from '../../../../components/layout/PageContainer';

// Department categories mapping
// Department categories mapping (keys match dept_sector from API)
const DEPARTMENT_CATEGORIES: Record<string, SelectOption[]> = {
  'it': [
    { value: 'hardware', label: 'Hardware Issue' },
    { value: 'software', label: 'Software Issue' },
    { value: 'network', label: 'Network Issue' },
    { value: 'email', label: 'Email Issue' },
    { value: 'access', label: 'Access Request' },
    { value: 'security', label: 'Security' },
    { value: 'other', label: 'Other' },
  ],
  'finance': [
    { value: 'payment', label: 'Payment Issue' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'expense', label: 'Expense' },
    { value: 'budget', label: 'Budget' },
    { value: 'reports', label: 'Financial Reports' },
    { value: 'other', label: 'Other' },
  ],
  'hr': [
    { value: 'leave', label: 'Leave' },
    { value: 'payroll', label: 'Payroll' },
    { value: 'policy', label: 'Policy' },
    { value: 'hiring', label: 'Hiring' },
    { value: 'other', label: 'Other' },
  ],
  'admin': [
    { value: 'facility', label: 'Facility' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'access', label: 'Access' },
    { value: 'other', label: 'Other' },
  ],
  'academic': [
    { value: 'course', label: 'Course Query' },
    { value: 'exam', label: 'Examination' },
    { value: 'result', label: 'Result' },
    { value: 'other', label: 'Other' },
  ],
  'default': [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Support Request' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'other', label: 'Other' },
  ]
};

export default function NewRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createTicket } = useTicketActions();

  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    department: '',
    category: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  const [attachments, setAttachments] = useState<FileWithStatus[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);


  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      setIsLoadingDepts(true);
      try {
        const data = await departmentService.getDepartments();
        setDepartments(data);
      } catch (error) {
        console.error('Error loading departments', error);
      } finally {
        setIsLoadingDepts(false);
      }
    };
    fetchDepartments();
  }, []);

  // Department options
  const departmentOptions: SelectOption[] = departments.map(dept => ({
    value: dept.id, // Use UUID as value
    label: dept.dept_name,
  }));

  // Category options (depends on department sector)
  const categoryOptions = useMemo<SelectOption[]>(() => {
    if (!formData.department) return [];

    const selectedDept = departments.find(d => d.id === formData.department);
    const sector = selectedDept?.dept_sector?.toLowerCase() || 'default';

    return DEPARTMENT_CATEGORIES[sector] || DEPARTMENT_CATEGORIES['default'];
  }, [formData.department, departments]);

  // Priority options with preview
  const priorityOptions: SelectOption[] = [
    { value: TICKET_PRIORITY.LOW, label: 'Low' },
    { value: TICKET_PRIORITY.MEDIUM, label: 'Medium' },
    { value: TICKET_PRIORITY.HIGH, label: 'High' },
    { value: TICKET_PRIORITY.URGENT, label: 'Urgent' },
  ];

  // Check open tickets count
  useEffect(() => {
    const checkOpenTickets = async () => {
      if (!user?.id) return;
      try {
        const response = await ticketService.getTickets({
          requestorId: user.id,
          status: 'pending,assigned,in_progress'
        });
        const tickets = Array.isArray(response) ? response : (response?.results || []);
        setOpenTicketsCount(tickets.length);
      } catch (error) {
        // Silently fail
      }
    };
    checkOpenTickets();
  }, [user?.id]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      // Reset category when department changes
      if (field === 'department') {
        newData.category = '';
        // Find selected department name for UI logic if needed, but value is now ID
      }
      return newData;
    });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setFormError(null);
  };

  const handleAttachmentsChange = useCallback(async (newAttachments: FileWithStatus[]) => {
    // Determine which files are new and need uploading
    const currentAttachmentIds = new Set(attachments.map(a => a.id));
    const newlyAdded = newAttachments.filter(a => !currentAttachmentIds.has(a.id));

    // Update state with new files initially (set to pending)
    setAttachments(newAttachments);

    // Filter out attachment error if we have files now
    if (newAttachments.length > 0 && errors.attachments) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.attachments;
        return newErrors;
      });
    }

    // Start uploads for newly added files
    newlyAdded.forEach(async (fileWithStatus) => {
      // Set to uploading
      setAttachments(prev => prev.map(a =>
        a.id === fileWithStatus.id ? { ...a, status: 'uploading', progress: 0 } : a
      ));

      try {
        const uploadRes = await fileService.uploadFile(
          fileWithStatus.file,
          'ticket_attachment',
          undefined, // No ticket ID yet
          (progress) => {
            setAttachments(prev => prev.map(a =>
              a.id === fileWithStatus.id ? { ...a, progress } : a
            ));
          }
        );

        // Success - Set to processing if scan is pending, or ready if clean
        const isClean = uploadRes.scan_status === 'clean';
        setAttachments(prev => prev.map(a =>
          a.id === fileWithStatus.id ? { 
            ...a, 
            status: isClean ? 'ready' : 'processing', 
            progress: 100,
            backendId: uploadRes.id 
          } : a
        ));

        // If not clean yet, start polling
        if (!isClean) {
          const pollInterval = setInterval(async () => {
             try {
               const statusRes = await apiClient.get(`${ENV.FILE_SERVICE_URL}/api/v1/files/${uploadRes.id}/status`);
               if (statusRes.scan_status === 'clean') {
                 setAttachments(prev => prev.map(a =>
                   a.id === fileWithStatus.id ? { ...a, status: 'ready' } : a
                 ));
                 clearInterval(pollInterval);
               } else if (statusRes.scan_status === 'infected' || statusRes.scan_status === 'failed') {
                 setAttachments(prev => prev.map(a =>
                   a.id === fileWithStatus.id ? { ...a, status: 'error', error: `Scan ${statusRes.scan_status}` } : a
                 ));
                 clearInterval(pollInterval);
               }
             } catch (e) {
               console.error('Polling failed', e);
               // Keep polling or stop on error? Let's stop after a few tries if needed.
             }
          }, 3000);

          // Stop polling after 1 minute (safety)
          setTimeout(() => clearInterval(pollInterval), 60000);
        }
      } catch (error: any) {
        console.error(`Upload failed for ${fileWithStatus.file.name}:`, error);
        setAttachments(prev => prev.map(a =>
          a.id === fileWithStatus.id ? {
            ...a,
            status: 'error',
            error: error.message || 'Network Error. Please try again.'
          } : a
        ));
      }
    });
  }, [attachments, errors.attachments]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const subjectError = validateTicketSubject(formData.subject);
    if (subjectError) newErrors.subject = subjectError;

    const descriptionError = validateTicketDescription(formData.description);
    if (descriptionError) newErrors.description = descriptionError;

    if (!validateRequired(formData.department)) {
      newErrors.department = 'Department is required';
    }

    if (!validateRequired(formData.category)) {
      newErrors.category = 'Category is required';
    }

    if (!validateRequired(formData.priority)) {
      newErrors.priority = 'Priority is required';
    }

    // Validation for attachments - now optional, but must be 'ready' if present
    const hasErrorAttachments = attachments.some(a => a.status === 'error');
    if (hasErrorAttachments) {
      newErrors.attachments = 'Please remove failed attachments before submitting';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setFormError(null);

    try {
      // Draft doesn't need full validation
      const ticket = await ticketService.createTicket({
        subject: formData.subject || 'Draft',
        description: formData.description || '',
        departmentId: formData.department, // Using ID now
        department: departments.find(d => d.id === formData.department)?.dept_name || 'Unknown', // Send name for fallback/display
        priority: formData.priority,
        category: formData.category,
        // attachments: attachments.map(f => f.file),
        status: 'draft',
        requestorId: user?.id || '',
      });

      if (ticket) {
        router.push(`/requestor/ticket/${ticket.id}`);
      }
    } catch (error: any) {
      setFormError(error.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      setFormError('Please fix the errors below');
      return;
    }

    // Check open tickets limit
    if (openTicketsCount >= 10) {
      setFormError('You have reached the maximum limit of 10 open tickets. Please resolve or close existing tickets before creating a new one.');
      return;
    }

    setLoading(true);

    try {
      const ticket = await createTicket({
        subject: formData.subject,
        description: formData.description,
        departmentId: formData.department, // Using ID now
        department: departments.find(d => d.id === formData.department)?.dept_name || 'Unknown',
        priority: formData.priority,
        category: formData.category,
        requestorId: user?.id || '',
        status: 'submitted',
        attachmentIds: attachments.filter(f => f.status === 'ready').map(f => (f as any).backendId).filter(Boolean),
      });

      if (ticket) {
        router.push(`/requestor/ticket/${ticket.id}`);
      }
    } catch (error: any) {
      setFormError(error.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const subjectCharCount = formData.subject.length;
  const descriptionCharCount = formData.description.length;

  // New Safety Logic check
  const isAttachmentsReady = attachments.every(a => a.status === 'ready');
  const isUploading = attachments.some(a => a.status === 'uploading');
  const hasUploadErrors = attachments.some(a => a.status === 'error');

  const isSubmitDisabled = 
    loading || 
    savingDraft || 
    isUploading || 
    hasUploadErrors || 
    (attachments.length > 0 && !isAttachmentsReady);

  return (
    <PageContainer fluid className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#274c77' }}>
            Create New Request
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Submit a new help desk ticket
          </p>
        </div>

        {/* Open Tickets Warning */}
        {openTicketsCount >= 8 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                You have {openTicketsCount} open tickets
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                {openTicketsCount >= 10
                  ? 'You have reached the maximum limit. Please resolve existing tickets before creating new ones.'
                  : 'You are approaching the limit of 10 open tickets.'}
              </p>
            </div>
          </div>
        )}

        {/* Form Error */}
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{formError}</p>
          </div>
        )}

        <Card className="shadow-xl">
          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <h2 className="text-lg font-semibold" style={{ color: THEME.colors.primary }}>
                  Basic Information
                </h2>

                {/* Subject */}
                <div className="space-y-2">
                  <Input
                    label="Subject"
                    type="text"
                    placeholder="Brief description of your request"
                    value={formData.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    error={errors.subject}
                    required
                    maxLength={200}
                    className="text-base"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Minimum 10 characters required
                    </span>
                    <span className={`text-xs ${subjectCharCount > 200 ? 'text-red-500' : 'text-gray-500'}`}>
                      {subjectCharCount} / 200
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <TextArea
                    label="Description"
                    placeholder="Provide detailed information about your request..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    error={errors.description}
                    rows={8}
                    required
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Minimum 20 characters required
                    </span>
                    <span className="text-xs text-gray-500">
                      {descriptionCharCount} characters
                    </span>
                  </div>
                </div>

                {/* Department and Category Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Select
                      label="Department"
                      options={departmentOptions}
                      value={formData.department}
                      onChange={(value) => handleChange('department', value)}
                      placeholder="Select department"
                      error={errors.department}
                      fullWidth
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Select
                      label="Category"
                      options={categoryOptions}
                      value={formData.category}
                      onChange={(value) => handleChange('category', value)}
                      placeholder={formData.department ? "Select category" : "Select department first"}
                      error={errors.category}
                      fullWidth
                      required
                      disabled={!formData.department}
                    />
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Select
                    label="Priority"
                    options={priorityOptions}
                    value={formData.priority}
                    onChange={(value) => handleChange('priority', value)}
                    placeholder="Select priority"
                    error={errors.priority}
                    fullWidth
                    required
                  />
                  {formData.priority && (
                    <div className="mt-2">
                      <PriorityBadge priority={formData.priority} />
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-4 pt-6 border-t" style={{ borderColor: THEME.colors.light + '40' }}>
                <div>
                  <h2 className="text-lg font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Attachments <span className="text-gray-400 text-sm font-normal">(Optional)</span>
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload files to support your request. Max 250MB per file, 100MB total.
                  </p>
                </div>
                <FileUpload
                  files={attachments}
                  onFilesChange={handleAttachmentsChange}
                  disabled={loading || savingDraft}
                />
                {errors.attachments && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.attachments}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t" style={{ borderColor: THEME.colors.light + '40' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => router.back()}
                  className="sm:flex-1"
                  disabled={loading || savingDraft}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleSaveDraft}
                  loading={savingDraft}
                  disabled={loading || savingDraft}
                  leftIcon={<Save className="w-4 h-4" />}
                  className="sm:flex-1"
                >
                  {savingDraft ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  disabled={isSubmitDisabled}
                  className="sm:flex-1"
                >
                  {isUploading ? 'Uploading Files...' : (loading ? 'Submitting...' : 'Submit Request')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </PageContainer>
  );
}

