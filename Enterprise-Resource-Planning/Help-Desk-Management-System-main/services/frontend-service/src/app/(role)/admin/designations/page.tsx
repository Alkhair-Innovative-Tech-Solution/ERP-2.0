'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { AnalyticsCard } from '../../../../components/common/AnalyticsCard';
import { THEME } from '../../../../lib/theme';
import { fetchDesignations, Designation } from '../../../../services/designationService';
import { fetchDepartments, Department } from '../../../../services/departmentService';
import {
  Briefcase,
  Search,
  Building2,
  ArrowLeft,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '../../../../components/layout/PageContainer';

interface DesignationWithDept extends Designation {
  dept_name?: string;
}

const DesignationsListPage: React.FC = () => {
  const router = useRouter();
  const [designations, setDesignations] = useState<DesignationWithDept[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    // Fetch departments first
    const deptResult = await fetchDepartments();
    if (deptResult.data) {
      setDepartments(deptResult.data);
    }

    // Fetch designations
    const desigResult = await fetchDesignations();

    if (desigResult.error && !desigResult.data) {
      setError(desigResult.error);
    } else if (desigResult.data) {
      // Enrich designations with department names
      const enrichedDesignations = desigResult.data.map(desig => ({
        ...desig,
        dept_name: deptResult.data?.find(d => d.dept_code === desig.dept_code)?.dept_name || 'Unknown'
      }));
      setDesignations(enrichedDesignations);
      setIsOffline(desigResult.isOffline || deptResult.isOffline);
    }

    setIsLoading(false);
  };

  const filteredDesignations = useMemo(() => {
    return designations.filter(desig => {
      const matchesSearch =
        desig.position_name.toLowerCase().includes(search.toLowerCase()) ||
        desig.position_code.toLowerCase().includes(search.toLowerCase()) ||
        (desig.dept_name && desig.dept_name.toLowerCase().includes(search.toLowerCase()));

      const matchesDepartment = !departmentFilter || desig.dept_code === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [designations, search, departmentFilter]);

  const stats = useMemo(() => {
    return {
      total: designations.length,
      departments: new Set(designations.map(d => d.dept_code)).size
    };
  }, [designations]);

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
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold" style={{ color: THEME.colors.primary }}>
                  All Designations
                </h1>
              </div>
              <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                View all job positions across departments
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <AnalyticsCard
          title="Total Designations"
          value={stats.total}
          icon={Briefcase}
          color={THEME.colors.primary}
          hoverDescription="All job positions"
        />
        <AnalyticsCard
          title="Departments"
          value={stats.departments}
          icon={Building2}
          color={THEME.colors.medium}
          hoverDescription="Departments with designations"
        />
      </div>

      {/* Search & Filter */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: THEME.colors.gray }} size={20} />
              <input
                type="text"
                placeholder="Search by position name, code, or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 md:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                style={{
                  borderColor: THEME.colors.background,
                }}
              />
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                Filter by Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                style={{
                  borderColor: THEME.colors.background,
                }}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.dept_code} value={dept.dept_code}>
                    {dept.dept_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="bg-red-50 rounded-2xl border border-red-200">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-700">Error loading designations</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <Button variant="outline" onClick={loadData} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Designations Table */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardHeader className="p-4 md:p-6 lg:p-8 pb-2 md:pb-4">
          <CardTitle className="text-lg md:text-xl lg:text-2xl font-bold" style={{ color: THEME.colors.primary }}>
            Designations List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
              <p style={{ color: THEME.colors.gray }}>Loading designations...</p>
            </div>
          ) : filteredDesignations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: THEME.colors.background }}>
                <Briefcase className="w-8 h-8" style={{ color: THEME.colors.gray }} />
              </div>
              <p className="text-gray-500 mb-4">No designations found</p>
              {(search || departmentFilter) && (
                <Button variant="outline" onClick={() => { setSearch(''); setDepartmentFilter(''); }}>
                  Clear Filters
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
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Position Name</th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: THEME.colors.background }}>
                      {filteredDesignations.map((desig, index) => (
                        <tr key={desig.id || index} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4 text-xs md:text-sm font-medium whitespace-nowrap" style={{ color: THEME.colors.primary }}>{desig.position_code}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: THEME.colors.primary }}>
                                {desig.position_name.charAt(0)}
                              </div>
                              <span className="text-xs md:text-sm font-medium" style={{ color: THEME.colors.primary }}>
                                {desig.position_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {desig.dept_name}
                            </span>
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

export default DesignationsListPage;
