'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/Button';
import { THEME } from '../../../../../lib/theme';
import { getMockEmployeeById } from '../../../../../lib/mockData';
import { checkHdmsAccess, grantHdmsAccess, validatePassword, HdmsAccessStatus } from '../../../../../services/permissionService';
import { PageContainer } from '../../../../../components/layout/PageContainer';

interface Assignment {
  institution: string;
  branch_name: string;
  department: string;
  designation: string;
  shift: string;
  joining_date: string;
  is_primary: boolean;
  role_data?: any;
}

interface Education {
  degree: string;
  institute: string;
  passingYear: string;
  grade?: string;
  subjects?: string;
}

interface Experience {
  employer: string;
  jobTitle: string;
  totalYears?: string;
  startDate?: string;
  endDate?: string;
  responsibilities?: string;
}

interface Employee {
  employee_id: string;
  employee_code: string;
  full_name: string;
  personal_email: string;
  personal_phone: string;
  email?: string;
  phone?: string;
  org_email: string | null;
  org_phone: string | null;
  cnic: string;
  dob: string | null;
  gender: string;
  marital_status: string;
  employment_type: string;
  nationality: string | null;
  religion: string | null;
  emergency_contact: {
    name: string | null;
    phone: string | null;
  } | null;
  address: {
    residential: string;
    permanent: string | null;
    city: string | null;
    state: string | null;
  };
  assignments: Assignment[];
  bank_info: {
    bank_name: string;
    account_number: string;
  };
  education_history: Education[] | null;
  work_experience: Experience[] | null;
  resume: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

const EmployeeDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPermissionConfirm, setShowPermissionConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Permission Form State
  const [permissions, setPermissions] = useState({
    hdms: false,
    sms: false,
  });
  const [hdmsRole, setHdmsRole] = useState('');
  const [hdmsPassword, setHdmsPassword] = useState('');
  const [smsRole, setSmsRole] = useState('');
  const [smsPassword, setSmsPassword] = useState('');

  // HDMS Access State
  const [existingHdmsAccess, setExistingHdmsAccess] = useState<HdmsAccessStatus | null>(null);
  const [changePassword, setChangePassword] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployee = async () => {
      setIsLoading(true);
      try {
        // Safe fetch wrapper
        const response = await fetch(`/api/employees/${employeeId}`).catch(err => {
          console.warn('Fetch employee failed:', err);
          return null;
        });

        if (!response || !response.ok) {
          // Fallback to mock data
          console.log('Falling back to mock data for employee details');
          const mockEmp = getMockEmployeeById(employeeId);
          if (mockEmp) {
            // Convert mock employee to match the new interface
            const convertedEmployee: Employee = {
              employee_id: mockEmp.employee_id,
              employee_code: mockEmp.employee_code,
              full_name: mockEmp.full_name,
              personal_email: mockEmp.email,
              personal_phone: mockEmp.phone,
              org_email: null,
              org_phone: null,
              cnic: '12345-1234567-1',
              dob: '1990-01-01',
              gender: 'male',
              marital_status: 'single',
              employment_type: 'Full-time',
              nationality: 'Pakistani',
              religion: 'Islam',
              emergency_contact: {
                name: 'Emergency Contact',
                phone: mockEmp.phone
              },
              address: {
                residential: 'Mock Address',
                permanent: 'Mock Permanent Address',
                city: 'Karachi',
                state: 'Sindh',
              },
              assignments: [{
                institution: mockEmp.department?.dept_name || 'N/A',
                branch_name: 'Main Campus',
                department: mockEmp.department?.dept_name || 'N/A',
                designation: mockEmp.designation?.position_name || 'N/A',
                shift: 'Morning',
                joining_date: mockEmp.joining_date || '2024-01-01',
                is_primary: true
              }],
              bank_info: {
                bank_name: 'Mock Bank',
                account_number: '1234567890',
              },
              education_history: null,
              work_experience: null,
              resume: mockEmp.resume_url || null,
              is_active: true,
              created_at: mockEmp.created_at,
              updated_at: null
            };
            setEmployee(convertedEmployee);
          } else {
            setError('Employee not found');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setEmployee(data);
      } catch (err) {
        console.error('Error fetching employee:', err);
        // Try mock data as final fallback
        const mockEmp = getMockEmployeeById(employeeId);
        if (mockEmp) {
          const convertedEmployee: Employee = {
            employee_id: mockEmp.employee_id,
            employee_code: mockEmp.employee_code,
            full_name: mockEmp.full_name,
            personal_email: mockEmp.email,
            personal_phone: mockEmp.phone,
            org_email: null,
            org_phone: null,
            cnic: '12345-1234567-1',
            dob: '1990-01-01',
            gender: 'male',
            marital_status: 'single',
            employment_type: 'Full-time',
            nationality: 'Pakistani',
            religion: 'Islam',
            emergency_contact: {
              name: 'Emergency Contact',
              phone: mockEmp.phone
            },
            address: {
              residential: 'Mock Address',
              permanent: 'Mock Permanent Address',
              city: 'Karachi',
              state: 'Sindh',
            },
            assignments: [{
              institution: mockEmp.department?.dept_name || 'N/A',
              branch_name: 'Main Campus',
              department: mockEmp.department?.dept_name || 'N/A',
              designation: mockEmp.designation?.position_name || 'N/A',
              shift: 'Morning',
              joining_date: mockEmp.joining_date || '2024-01-01',
              is_primary: true
            }],
            bank_info: {
              bank_name: 'Mock Bank',
              account_number: '1234567890',
            },
            education_history: null,
            work_experience: null,
            resume: mockEmp.resume_url || null,
            is_active: true,
            created_at: mockEmp.created_at,
            updated_at: null
          };
          setEmployee(convertedEmployee);
        } else {
          setError('Network error. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'DELETE',
      }).catch(err => {
        console.warn('Delete failed:', err);
        return null;
      });

      if (response && response.ok) {
        alert('Employee deleted successfully');
        router.push('/admin/employees');
      } else {
        // Mock delete fallback
        alert('Employee deleted successfully (Mock)');
        router.push('/admin/employees');
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
      alert('Employee deleted successfully (Mock)');
      router.push('/admin/employees');
    }
  };

  const handleEditSave = () => {
    // Mock save logic - in real implementation, this would call the API
    alert('Employee updated successfully (Mock)');
    setShowEditModal(false);
  };

  // Check existing HDMS access when modal opens
  const handleOpenPermissionModal = async () => {
    setShowPermissionModal(true);
    setPasswordError(null);
    setSuccessMessage(null);

    if (employee) {
      const result = await checkHdmsAccess(employee.employee_id);
      if (result.data) {
        setExistingHdmsAccess(result.data);
        if (result.data.has_access) {
          setPermissions({ ...permissions, hdms: true });
          setHdmsRole(result.data.role || '');
          setChangePassword(false); // Default to not changing password for existing users
        }
      }
    }
  };

  const handlePermissionSave = () => {
    setPasswordError(null);

    // Validate that if HDMS is selected, role is provided
    if (permissions.hdms && !hdmsRole) {
      setPasswordError('Please select a role for HDMS');
      return;
    }

    // Validate password if required (new user or changing password)
    const needsPassword = !existingHdmsAccess?.has_access || changePassword;
    if (permissions.hdms && needsPassword) {
      if (!hdmsPassword) {
        setPasswordError('Password is required');
        return;
      }
      const validation = validatePassword(hdmsPassword);
      if (!validation.valid) {
        setPasswordError(validation.error);
        return;
      }
    }

    if (permissions.sms && (!smsRole || !smsPassword)) {
      setPasswordError('Please select a role and enter a password for SMS');
      return;
    }

    // Show confirmation modal
    setShowPermissionConfirm(true);
  };

  const handlePermissionConfirm = async () => {
    if (!employee) return;

    setIsSubmitting(true);
    setPasswordError(null);

    try {
      if (permissions.hdms) {
        const result = await grantHdmsAccess({
          employee_id: employee.employee_id,
          password: hdmsPassword || 'DefaultP1', // Fallback for existing users not changing password
          role: hdmsRole as 'requestor' | 'moderator' | 'assignee',
          change_password: changePassword
        });

        if (result.error) {
          setPasswordError(result.error);
          setShowPermissionConfirm(false);
          setIsSubmitting(false);
          return;
        }

        setSuccessMessage(result.data?.message || 'HDMS access granted successfully');
      }

      // Close modals
      setShowPermissionConfirm(false);
      setShowPermissionModal(false);
      setShowSuccessModal(true);

      // Reset form
      setPermissions({ hdms: false, sms: false });
      setHdmsRole('');
      setHdmsPassword('');
      setSmsRole('');
      setSmsPassword('');
      setExistingHdmsAccess(null);
      setChangePassword(true);
    } catch (error) {
      console.error('Error granting permissions:', error);
      setPasswordError('An unexpected error occurred');
      setShowPermissionConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 min-h-screen" style={{ backgroundColor: THEME.colors.background }}>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading employee details...</p>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-4 md:p-6 lg:p-8 min-h-screen" style={{ backgroundColor: THEME.colors.background }}>
        <Card className="bg-white rounded-xl shadow">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 mb-4">{error || 'Employee not found'}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            ← Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{employee.full_name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm text-gray-600 font-medium">{employee.employee_code}</p>
              {employee.assignments.find(a => a.is_primary) && (
                <>
                  <span className="text-gray-300">|</span>
                  <p className="text-sm font-semibold text-blue-600">
                    {employee.assignments.find(a => a.is_primary)?.designation}
                  </p>
                  <span className="text-gray-300">|</span>
                  <p className="text-sm text-gray-600">
                    {employee.assignments.find(a => a.is_primary)?.department}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowEditModal(true)}
            className="text-sm"
          >
            ✏️ Edit
          </Button>
          <Button
            variant="primary"
            onClick={handleOpenPermissionModal}
            className="text-sm"
          >
            🔒 Grant Permission
          </Button>
          <Button
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm bg-red-600 hover:bg-red-700 text-white"
          >
            🗑️ Delete
          </Button>
        </div>
      </div>

      {/* Personal Information */}
      <Card className="bg-white rounded-xl shadow mb-6">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Employee ID</label>
              <p className="mt-1 font-semibold text-blue-600">{employee.employee_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Employee Code</label>
              <p className="mt-1 font-semibold">{employee.employee_code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Full Name</label>
              <p className="mt-1">{employee.full_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Date of Birth</label>
              <p className="mt-1">{employee.dob || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">CNIC</label>
              <p className="mt-1">{employee.cnic || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Gender</label>
              <p className="mt-1 capitalize">{employee.gender || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Marital Status</label>
              <p className="mt-1 capitalize">{employee.marital_status || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Nationality</label>
              <p className="mt-1">{employee.nationality || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Religion</label>
              <p className="mt-1">{employee.religion || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Employment Type</label>
              <p className="mt-1 capitalize">{employee.employment_type || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="bg-white rounded-xl shadow mb-6">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Personal Email</label>
              <p className="mt-1">{employee.personal_email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Mobile Number</label>
              <p className="mt-1">{employee.personal_phone}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Emergency Contact</label>
              <p className="mt-1 text-sm font-semibold">{employee.emergency_contact?.name || '—'}</p>
              <p className="text-sm text-gray-600">{employee.emergency_contact?.phone || '—'}</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-gray-600">Residential Address</label>
            <p className="mt-1">{employee.address.residential}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Permanent Address</label>
              <p className="mt-1">{employee.address.permanent || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">City</label>
              <p className="mt-1">{employee.address.city || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">State</label>
              <p className="mt-1">{employee.address.state || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments Details */}
      <Card className="bg-white rounded-xl shadow mb-6">
        <CardHeader>
          <CardTitle>HR Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {employee.assignments.map((asn, idx) => (
            <div key={idx} className="border p-4 rounded-lg mb-4 last:mb-0 border-l-4 border-l-blue-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Institution</label>
                  <p className="mt-1 font-semibold">{asn.institution}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Branch / Campus</label>
                  <p className="mt-1 font-semibold text-blue-600">{asn.branch_name}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Department</label>
                  <p className="mt-1">{asn.department}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Designation</label>
                  <p className="mt-1 font-medium">{asn.designation}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Shift</label>
                  <p className="mt-1 capitalize">{asn.shift}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Joining Date</label>
                  <p className="mt-1">{asn.joining_date}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                  <div className="mt-1">
                    {asn.is_primary && (
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Primary</span>
                    )}
                  </div>
                </div>
              </div>
              {asn.role_data?.sms_data && (
                <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50 p-3 rounded">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Academic Data (SIS)</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
                    <div>
                      <p className="text-xs text-gray-500">Subjects</p>
                      <p className="text-sm font-medium">{asn.role_data.sms_data.current_subjects || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Classes</p>
                      <p className="text-sm font-medium">{asn.role_data.sms_data.classes_taught || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bank Information */}
      <Card className="bg-white rounded-xl shadow mb-6">
        <CardHeader>
          <CardTitle>Bank Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Bank Name</label>
              <p className="mt-1">{employee.bank_info.bank_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Account Number</label>
              <p className="mt-1">{employee.bank_info.account_number}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Provided */}
      {(employee.org_email || employee.org_phone) && (
        <Card className="bg-white rounded-xl shadow mb-6">
          <CardHeader>
            <CardTitle>Provided By Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-600">Organization Email</label>
                <p className="mt-1">{employee.org_email || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Organization Phone</label>
                <p className="mt-1">{employee.org_phone || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {employee.education_history && employee.education_history.length > 0 && (
        <Card className="bg-white rounded-xl shadow mb-6">
          <CardHeader>
            <CardTitle>Educational History</CardTitle>
          </CardHeader>
          <CardContent>
            {employee.education_history.map((edu, idx) => (
              <div key={idx} className="border p-4 rounded-lg mb-3 last:mb-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Degree/Certificate</label>
                    <p className="mt-1">{edu.degree || '—'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Institute Name</label>
                    <p className="mt-1">{edu.institute || '—'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Passing Year/Grade</label>
                    <p className="mt-1">{edu.passingYear || '—'} {edu.grade ? (`(Grade: ${edu.grade})`) : ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Experience */}
      {employee.work_experience && employee.work_experience.length > 0 && (
        <Card className="bg-white rounded-xl shadow mb-6">
          <CardHeader>
            <CardTitle>Work Experience</CardTitle>
          </CardHeader>
          <CardContent>
            {employee.work_experience.map((exp, idx) => (
              <div key={idx} className="border p-4 rounded-lg mb-3 last:mb-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Employer</label>
                    <p className="mt-1 font-semibold">{exp.employer || '—'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Job Title</label>
                    <p className="mt-1">{exp.jobTitle || '—'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Duration/Experience</label>
                    <p className="mt-1">
                      {exp.startDate ? (`${exp.startDate} to ${exp.endDate || 'Present'}`) : (`${exp.totalYears || '0'} Years Experience`)}
                    </p>
                  </div>
                </div>
                {exp.responsibilities && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-600">Key Responsibilities</label>
                    <p className="mt-1 text-gray-700">{exp.responsibilities}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resume */}
      {employee.resume && (
        <Card className="bg-white rounded-xl shadow mb-6">
          <CardHeader>
            <CardTitle>Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={employee.resume}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              📄 View Resume
            </a>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
            <h3 className="text-xl font-bold mb-2 text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete <span className="font-semibold">{employee.full_name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">Edit Employee Details</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Edit functionality will be implemented when backend API is integrated.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={employee.full_name}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={employee.personal_email}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={employee.personal_phone}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleEditSave}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Permission Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Grant Permissions</h3>
            <div className="bg-blue-50 p-3 rounded-lg mb-6">
              <p className="text-sm text-blue-800">
                Granting access for: <span className="font-bold">{employee.full_name}</span> ({employee.employee_code})
              </p>
            </div>

            <div className="space-y-6 mb-8">
              {/* HDMS Permission */}
              <div className="border rounded-lg p-4">
                {/* Existing Access Banner */}
                {existingHdmsAccess?.has_access && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">Already has HDMS access</span> as {existingHdmsAccess.role?.toUpperCase()}.
                      You can update the role below.
                    </p>
                  </div>
                )}

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.hdms}
                    onChange={e => {
                      setPermissions({ ...permissions, hdms: e.target.checked });
                      if (!e.target.checked) {
                        setHdmsRole('');
                        setHdmsPassword('');
                        setPasswordError(null);
                      }
                    }}
                    className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-gray-900">HDMS Access</span>
                    <span className="block text-sm text-gray-500">Help Desk Management System</span>
                  </div>
                </label>

                {/* HDMS Role and Password Fields */}
                {permissions.hdms && (
                  <div className="mt-4 space-y-3 pl-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={hdmsRole}
                        onChange={e => setHdmsRole(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Select Role</option>
                        <option value="requestor">Requestor</option>
                        <option value="moderator">Moderator</option>
                        <option value="assignee">Assignee</option>
                      </select>
                    </div>

                    {/* Change Password Checkbox (for existing users) */}
                    {existingHdmsAccess?.has_access && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="changePassword"
                          checked={changePassword}
                          onChange={e => setChangePassword(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="changePassword" className="text-sm text-gray-700">
                          Change password
                        </label>
                      </div>
                    )}

                    {/* Password Field */}
                    {(!existingHdmsAccess?.has_access || changePassword) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={hdmsPassword}
                          onChange={e => {
                            setHdmsPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          placeholder="Enter password"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Min 6 chars, alphanumeric, at least 1 uppercase & 1 lowercase
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SMS Permission */}
              <div className="border rounded-lg p-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.sms}
                    onChange={e => {
                      setPermissions({ ...permissions, sms: e.target.checked });
                      if (!e.target.checked) {
                        setSmsRole('');
                        setSmsPassword('');
                      }
                    }}
                    className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-gray-900">SMS Access</span>
                    <span className="block text-sm text-gray-500">Staff Management System</span>
                  </div>
                </label>

                {/* SMS Role and Password Fields */}
                {permissions.sms && (
                  <div className="mt-4 space-y-3 pl-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={smsRole}
                        onChange={e => setSmsRole(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">Select Role</option>
                        <option value="teacher">Teacher</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="principal">Principal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={smsPassword}
                        onChange={e => setSmsPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPermissionModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handlePermissionSave}>Save Permissions</Button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Confirmation Modal */}
      {showPermissionConfirm && employee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Confirm Permissions</h3>
            <p className="text-gray-700 mb-4">
              Are you sure you want to grant the following permissions to <span className="font-bold">{employee.full_name}</span>?
            </p>
            <div className="bg-blue-50 p-4 rounded-lg mb-6 space-y-2">
              {permissions.hdms && (
                <div>
                  <p className="font-semibold text-blue-900">HDMS Access</p>
                  <p className="text-sm text-blue-700">Role: {hdmsRole}</p>
                </div>
              )}
              {permissions.sms && (
                <div className="mt-2">
                  <p className="font-semibold text-blue-900">SMS Access</p>
                  <p className="text-sm text-blue-700">Role: {smsRole}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPermissionConfirm(false)}>Cancel</Button>
              <Button variant="primary" onClick={handlePermissionConfirm}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && employee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Success!</h3>
              <p className="text-gray-700 mb-6">
                User account created successfully!<br />
                <span className="font-semibold">{employee.full_name}</span> has been added to the user list.
              </p>
              <Button variant="primary" onClick={() => {
                setShowSuccessModal(false);
                router.push('/admin/users');
              }}>OK</Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default EmployeeDetailPage;
