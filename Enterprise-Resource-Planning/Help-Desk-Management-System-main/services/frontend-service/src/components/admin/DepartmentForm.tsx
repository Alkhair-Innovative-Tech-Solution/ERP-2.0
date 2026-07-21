'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import { createDepartment, updateDepartment, DepartmentCreateData } from '../../services/departmentService';

// Sector values matching the backend
type Sector = 'academic' | 'it' | 'finance' | 'medical' | 'hr' | 'admin' | 'procurement' | 'other';

const SECTOR_OPTIONS: { value: Sector; label: string }[] = [
  { value: 'academic', label: 'Academic' },
  { value: 'it', label: 'Information Technology' },
  { value: 'finance', label: 'Finance & Accounting' },
  { value: 'medical', label: 'Medical & Health' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'admin', label: 'Administration' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'other', label: 'Other' },
];

interface Department {
  dept_code?: string;
  dept_name?: string;
  dept_sector?: string;
  description?: string;
}

interface DepartmentFormProps {
  initial?: Partial<Department>;
  isEditing?: boolean;
}

const DepartmentForm: React.FC<DepartmentFormProps> = ({ initial = {}, isEditing = false }) => {
  const router = useRouter();
  const [code, setCode] = useState(initial.dept_code || '');
  const [name, setName] = useState(initial.dept_name || '');
  const [sector, setSector] = useState<Sector>((initial.dept_sector as Sector) || 'other');
  const [description, setDescription] = useState(initial.description || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
  }, [code, name, sector]);

  const validate = (): string | null => {
    if (!code.trim()) return 'Department Code is required';
    if (!/^[A-Za-z0-9]+$/.test(code)) return 'Code must be alphanumeric only (no special characters)';
    if (code.length > 6) return 'Code must be 6 characters or less';
    if (!name.trim()) return 'Department Name is required';
    if (name.length > 200) return 'Department Name must be 200 characters or less';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: DepartmentCreateData = {
      dept_code: code.trim().toUpperCase(),
      dept_name: name.trim(),
      dept_sector: sector,
      description: description.trim() || undefined,
    };

    try {
      if (isEditing && initial.dept_code) {
        // Update existing department
        const result = await updateDepartment(initial.dept_code, {
          dept_name: payload.dept_name,
          dept_sector: payload.dept_sector,
          description: payload.description,
        });

        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }

        setSuccessMessage('Department updated successfully!');
      } else {
        // Create new department
        const result = await createDepartment(payload);

        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }

        setSuccessMessage('Department created successfully!');
      }

      // Redirect after short delay to show success message
      setTimeout(() => {
        router.push('/admin/departments');
      }, 1000);
    } catch (err) {
      console.error('Error saving department:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Department' : 'Add Department'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Department Code * <span className="text-gray-500 font-normal">(max 6 chars)</span>
              </label>
              <input
                maxLength={6}
                placeholder="e.g., IT, HR, FIN"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={isEditing}
                className={`w-full px-3 py-2 border rounded ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              <p className="text-xs text-gray-500 mt-1">Short unique code (alphanumeric only, e.g., AIT, HR, FIN)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Department Name *</label>
              <input
                maxLength={200}
                placeholder="e.g., Information Technology"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Organizational Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as Sector)}
              className="w-full px-3 py-2 border rounded"
            >
              {SECTOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Which sector does this department belong to?</p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Department Description</label>
            <textarea
              rows={4}
              placeholder="Describe department functions, goals, and responsibilities..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push('/admin/departments')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update Department' : 'Create Department')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

export default DepartmentForm;
