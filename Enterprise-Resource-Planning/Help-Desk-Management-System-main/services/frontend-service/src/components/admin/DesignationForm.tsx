'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';

interface DepartmentItem { id: string; code: string; name: string }
interface Designation {
  id: string;
  departmentId: string;
  departmentCode?: string;
  positionCode: string;
  positionName: string;
  roleDescription?: string;
  jobGrade?: string;
  minQualifications?: string;
  reportsToId?: string;
}

const DesignationForm: React.FC<{ initial?: Partial<Designation> }> = ({ initial = {} }) => {
  const router = useRouter();
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [departmentId, setDepartmentId] = useState(initial.departmentId || '');
  const [positionCode, setPositionCode] = useState(initial.positionCode || '');
  const [positionName, setPositionName] = useState(initial.positionName || '');
  const [roleDescription, setRoleDescription] = useState(initial.roleDescription || '');
  const [jobGrade, setJobGrade] = useState(initial.jobGrade || '');
  const [minQualifications, setMinQualifications] = useState(initial.minQualifications || '');
  const [reportsToId, setReportsToId] = useState(initial.reportsToId || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('departments') : null;
    if (stored) {
      try {
        const deps = JSON.parse(stored) as DepartmentItem[];
        setDepartments(deps);
        if (!departmentId && deps.length > 0) setDepartmentId(deps[0].id);
      } catch {
        setDepartments([]);
      }
    }
  }, []);

  const validate = (): string | null => {
    if (!departmentId) return 'Select a department';
    if (!positionCode.trim()) return 'Position Code is required';
    if (positionCode.length > 10) return 'Position Code must be 10 characters or less';
    if (!positionName.trim()) return 'Position Name is required';

    // unique within department
    const stored = typeof window !== 'undefined' ? localStorage.getItem('designations') : null;
    const list = stored ? JSON.parse(stored) as Designation[] : [];
    const exists = list.some(d => d.departmentId === departmentId && d.positionCode.toLowerCase() === positionCode.toLowerCase() && d.id !== initial.id);
    if (exists) return 'Position Code must be unique within the department';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    const stored = typeof window !== 'undefined' ? localStorage.getItem('designations') : null;
    const list = stored ? JSON.parse(stored) as Designation[] : [];

    const dept = departments.find(d => d.id === departmentId);

    const payload: Designation = {
      id: initial.id || `DESG-${Date.now()}`,
      departmentId,
      departmentCode: dept?.code,
      positionCode: positionCode.trim(),
      positionName: positionName.trim(),
      roleDescription: roleDescription.trim() || undefined,
      jobGrade: jobGrade || undefined,
      minQualifications: minQualifications.trim() || undefined,
      reportsToId: reportsToId || undefined,
    };

    const idx = list.findIndex(x => x.id === payload.id);
    if (idx >= 0) list[idx] = payload; else list.push(payload);
    localStorage.setItem('designations', JSON.stringify(list));
    router.push(`/${'admin'}/designations`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Designation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Department *</label>
              <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full px-3 py-2 border rounded">
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Choose which department this designation belongs to</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Position Code *</label>
              <input maxLength={10} placeholder="T, P, DEV" value={positionCode} onChange={e => setPositionCode(e.target.value)} className="w-full px-3 py-2 border rounded" />
              <p className="text-xs text-gray-500 mt-1">Short code used in employee codes (unique within department)</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Position Name *</label>
            <input maxLength={100} placeholder="Example: Teacher" value={positionName} onChange={e => setPositionName(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Role Description & Responsibilities</label>
            <textarea rows={5} placeholder="Describe key responsibilities..." value={roleDescription} onChange={e => setRoleDescription(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Advanced Options</summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Job Grade</label>
                <select value={jobGrade} onChange={e => setJobGrade(e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">Select grade</option>
                  <option>Junior</option>
                  <option>Mid-Level</option>
                  <option>Senior</option>
                  <option>Lead</option>
                  <option>Manager</option>
                  <option>Director</option>
                  <option>Executive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Minimum Required Qualifications</label>
                <textarea rows={3} value={minQualifications} onChange={e => setMinQualifications(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Bachelors + 2 years..." />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Reporting Position</label>
              <select value={reportsToId} onChange={e => setReportsToId(e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="">Select reporting position (optional)</option>
                {/* list of designations in same department */}
                {(() => {
                  const stored = typeof window !== 'undefined' ? localStorage.getItem('designations') : null;
                  if (!stored) return null;
                  try {
                    const list = JSON.parse(stored) as Designation[];
                    return list.filter(d => d.departmentId === departmentId).map(d => (
                      <option key={d.id} value={d.id}>{d.positionCode} - {d.positionName}</option>
                    ));
                  } catch {
                    return null;
                  }
                })()}
              </select>
            </div>
          </details>

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" type="button" onClick={() => router.push(`/${'admin'}/designations`)}>Cancel</Button>
            <Button type="submit">Save Designation</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

export default DesignationForm;
