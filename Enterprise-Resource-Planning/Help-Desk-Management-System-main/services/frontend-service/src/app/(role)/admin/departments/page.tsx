'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { AnalyticsCard } from '../../../../components/common/AnalyticsCard';
import { THEME } from '../../../../lib/theme';
import { fetchDepartments, Department } from '../../../../services/departmentService';
import { getMockDesignations } from '../../../../lib/mockData';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Briefcase,
  Layers,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { PageContainer } from '../../../../components/layout/PageContainer';

const DepartmentsListPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchDepartments();

    if (result.error && !result.data) {
      setError(result.error);
    } else {
      setDepartments(result.data || []);
      setIsOffline(result.isOffline);
    }

    setIsLoading(false);
  };

  const filteredDepartments = useMemo(() => {
    return departments.filter(dept =>
      dept.dept_name.toLowerCase().includes(search.toLowerCase()) ||
      dept.dept_code.toLowerCase().includes(search.toLowerCase()) ||
      (dept.dept_sector?.toLowerCase() || '').includes(search.toLowerCase())
    );
  }, [departments, search]);

  const stats = useMemo(() => {
    return {
      total: departments.length,
      sectors: new Set(departments.map(d => d.dept_sector)).size,
      designations: getMockDesignations().length
    };
  }, [departments]);

  return (
    <PageContainer className="space-y-4 md:space-y-6">
      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <WifiOff className="w-5 h-5 text-amber-600" />
          <span className="text-amber-700 text-sm font-medium">
            Using offline data. Some features may be limited.
          </span>
        </div>
      )}

      {/* Page Header */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
                Department Management
              </h1>
              <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                Manage departments and organizational structure
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/designations">
                <Button
                  variant="outline"
                  leftIcon={<Briefcase className="w-4 h-4" />}
                >
                  View All Designations
                </Button>
              </Link>
              <Link href="/admin/departments/new">
                <Button
                  variant="primary"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add Department
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <AnalyticsCard
          title="Total Departments"
          value={stats.total}
          icon={Building2}
          color={THEME.colors.primary}
          hoverDescription="Active departments"
        />
        <AnalyticsCard
          title="Total Sectors"
          value={stats.sectors}
          icon={Layers}
          color={THEME.colors.medium}
          hoverDescription="Business sectors"
        />
        <AnalyticsCard
          title="Total Designations"
          value={stats.designations}
          icon={Briefcase}
          color={THEME.colors.success}
          hoverDescription="Job positions across all departments"
        />
      </div>

      {/* Search */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: THEME.colors.gray }} size={20} />
            <input
              type="text"
              placeholder="Search by name, code, or sector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 md:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
              style={{
                borderColor: THEME.colors.background,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="bg-red-50 rounded-2xl border border-red-200">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-700">Error loading departments</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <Button variant="outline" onClick={loadDepartments} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Departments Table */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardHeader className="p-4 md:p-6 lg:p-8 pb-2 md:pb-4">
          <CardTitle className="text-lg md:text-xl lg:text-2xl font-bold" style={{ color: THEME.colors.primary }}>
            Departments List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
              <p style={{ color: THEME.colors.gray }}>Loading departments...</p>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: THEME.colors.background }}>
                <Building2 className="w-8 h-8" style={{ color: THEME.colors.gray }} />
              </div>
              <p className="text-gray-500 mb-4">No departments found</p>
              {search && (
                <Button variant="outline" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y" style={{ borderColor: THEME.colors.background }}>
                    <thead>
                      <tr className="border-b-2" style={{ borderColor: THEME.colors.background }}>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Code</th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Name</th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Inst.</th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Sector</th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Description</th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: THEME.colors.background }}>
                      {filteredDepartments.map((dept) => (
                        <tr key={dept.dept_code} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4 text-xs md:text-sm font-medium whitespace-nowrap" style={{ color: THEME.colors.primary }}>{dept.dept_code}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: THEME.colors.primary }}>
                                {dept.dept_name.charAt(0)}
                              </div>
                              <span className="text-xs md:text-sm font-medium" style={{ color: THEME.colors.primary }}>
                                {dept.dept_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded font-bold text-[10px] uppercase">
                              {dept.institution_code || 'Global'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {dept.dept_sector}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap text-gray-500 max-w-xs truncate">{dept.description}</td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <Link href={`/admin/departments/${dept.dept_code}`}>
                              <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<Eye className="w-3 h-3" />}
                                className="text-xs px-2 md:px-3"
                              >
                                View Details
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default DepartmentsListPage;
