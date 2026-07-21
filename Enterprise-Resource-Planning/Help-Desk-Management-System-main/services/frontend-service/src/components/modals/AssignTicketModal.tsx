'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Check, Loader } from 'lucide-react';
import { Button } from '../ui/Button';
import { departmentService, Department } from '../../services/api/departmentService';
import { DEPARTMENTS } from '../../lib/constants';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
}

interface AssignTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (assigneeId: string, departmentId?: string) => void;
  assignees: User[];
  ticketSubject: string;
  ticketDepartment: string;
  loading?: boolean;
}

const AssignTicketModal: React.FC<AssignTicketModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  assignees,
  ticketSubject,
  ticketDepartment,
  loading = false
}) => {
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Fetch departments from auth-service
  useEffect(() => {
    if (!isOpen) return;

    const fetchDepartments = async () => {
      setLoadingDepts(true);
      try {
        const data = await departmentService.getDepartments();
        setDepartments(data);
      } catch (error) {
        console.warn('Failed to fetch departments, using fallback');
        // Fallback to hardcoded departments if API fails
      } finally {
        setLoadingDepts(false);
      }
    };
    fetchDepartments();
  }, [isOpen]);

  if (!isOpen) return null;

  // Mock availability data - in real app, this would come from backend
  const assigneeAvailability: { [key: string]: 'available' | 'busy' } = {
    '2': 'available' // Rajeev Kumar
  };

  const getRoleLabel = (assignee: User) => {
    if (assignee.name.includes('Rajeev')) return 'IT Tech';
    return 'IT Support';
  };

  const filteredAssignees = assignees.filter(assignee => {
    if (!selectedDepartment || selectedDepartment === 'all') return true;
    // Match by department name or ID
    const selectedDept = departments.find(d => d.id === selectedDepartment);
    return assignee.department === selectedDept?.dept_name || assignee.department === selectedDepartment;
  });

  const handleAssign = () => {
    if (selectedAssignee) {
      const selectedDeptId = selectedDepartment !== 'all' ? selectedDepartment : undefined;
      onAssign(selectedAssignee, selectedDeptId);
      setSelectedAssignee('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b z-10">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Assign Ticket</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Left: Ticket Details */}
          <div className="border-r pr-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ticket Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Subject:</p>
                <p className="font-semibold text-gray-900">{ticketSubject}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Department:</p>
                <p className="font-medium text-gray-800">{ticketDepartment}</p>
              </div>
            </div>
          </div>

          {/* Right: Assign to */}
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loadingDepts}
              >
                <option value="all">All Departments</option>
                {departments.length > 0 ? (
                  departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.dept_name}</option>
                  ))
                ) : (
                  DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))
                )}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to
              </label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAssignees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No assignees found in this department
                  </div>
                ) : (
                  filteredAssignees.map((assignee) => {
                    const isSelected = selectedAssignee === assignee.id;
                    const availability = assigneeAvailability[assignee.id] || 'available';
                    const isAvailable = availability === 'available';

                    return (
                      <div
                        key={assignee.id}
                        onClick={() => setSelectedAssignee(assignee.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{assignee.name}</p>
                              {isSelected && (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600">({getRoleLabel(assignee)})</p>
                            <div className="flex items-center gap-2 mt-1">
                              {isAvailable ? (
                                <>
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-xs text-green-600">Available</span>
                                </>
                              ) : (
                                <>
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span className="text-xs text-red-600">Busy</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex space-x-3">
          <Button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedAssignee || loading}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${selectedAssignee && !loading
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                Assigning...
              </span>
            ) : (
              'Assign Ticket'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssignTicketModal;
