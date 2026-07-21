'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { AnalyticsCard } from '../../../../components/common/AnalyticsCard';
import { THEME } from '../../../../lib/theme';
import { getMockEmployees, MockEmployee, getMockDepartments, getMockDesignations } from '../../../../lib/mockData';
import { getInitials } from '../../../../lib/helpers';
import {
	Users,
	UserPlus,
	Search,
	Filter,
	Eye,
	Building2,
	Briefcase,
	Clock,
	UserCheck
} from 'lucide-react';

interface Department {
	dept_code: string;
	dept_name: string;
}

interface Designation {
	position_code: string;
	position_name: string;
}

interface Employee {
	employee_id: string;
	employee_code: string;
	full_name: string;
	email: string;
	phone: string;
	department: Department | null;
	designation: Designation | null;
	employment_type: string;
	employment_type_value: string;
	joining_date: string | null;
	created_at: string | null;
}

interface EmployeeListResponse {
	employees: Employee[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
}

const EmployeesListPage: React.FC = () => {
	const [employees, setEmployees] = useState<Employee[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [isLoading, setIsLoading] = useState(true);

	// Filters
	const [search, setSearch] = useState('');
	const [searchDebounced, setSearchDebounced] = useState('');
	const [departmentFilter, setDepartmentFilter] = useState('');
	const [designationFilter, setDesignationFilter] = useState('');
	const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
	const [showFilters, setShowFilters] = useState(false);

	// Dropdown data
	const [departments, setDepartments] = useState<any[]>([]);
	const [designations, setDesignations] = useState<any[]>([]);

	// Debounce search
	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchDebounced(search);
			setPage(1); // Reset to page 1 on search
		}, 500);
		return () => clearTimeout(timer);
	}, [search]);

	// Fetch departments and designations for filters
	useEffect(() => {
		const fetchDropdowns = async () => {
			try {
				// Helper to safely fetch and return null on error
				const safeFetch = (url: string) => fetch(url).then(res => res).catch(err => {
					console.warn(`Fetch failed for ${url}`, err);
					return null;
				});

				const [deptsRes, desigsRes] = await Promise.all([
					safeFetch('/api/departments'),
					safeFetch('/api/designations')
				]);

				if (!deptsRes || !deptsRes.ok || !desigsRes || !desigsRes.ok) {
					// Fallback to mock data instead of throwing error
					console.log('API not available, using mock data for dropdowns');
					setDepartments(getMockDepartments());
					setDesignations(getMockDesignations());
					return;
				}

				const [deptsData, desigsData] = await Promise.all([
					deptsRes.json(),
					desigsRes.json()
				]);
				setDepartments(deptsData);
				setDesignations(desigsData);
			} catch (err) {
				console.error('Failed to fetch dropdowns, falling back to mock:', err);
				setDepartments(getMockDepartments());
				setDesignations(getMockDesignations());
			}
		};
		fetchDropdowns();
	}, []);

	// Fetch employees
	useEffect(() => {
		const fetchEmployees = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({
					page: page.toString(),
					per_page: '20'
				});

				if (searchDebounced) params.append('search', searchDebounced);
				if (departmentFilter) params.append('department', departmentFilter);
				if (designationFilter) params.append('designation', designationFilter);
				if (employmentTypeFilter) params.append('employment_type', employmentTypeFilter);

				// Use safe fetch pattern
				const response = await fetch(`/api/employees?${params}`).catch(err => {
					console.warn('Fetch employees failed:', err);
					return null;
				});

				if (!response || !response.ok) {
					throw new Error('Failed to fetch employees');
				}

				const data: EmployeeListResponse = await response.json();

				setEmployees(data.employees || []);
				setTotal(data.total || 0);
				setTotalPages(data.total_pages || 0);
			} catch (err) {
				console.error('Failed to fetch employees:', err);
				// Fallback to mock data
				console.log('Falling back to mock data');
				const mockData = getMockEmployees();
				// Cast mock data to Employee type (they should be compatible)
				setEmployees(mockData as unknown as Employee[]);
				setTotal(mockData.length);
				setTotalPages(1);
			} finally {
				setIsLoading(false);
			}
		};

		fetchEmployees();
	}, [page, searchDebounced, departmentFilter, designationFilter, employmentTypeFilter]);

	const clearFilters = () => {
		setSearch('');
		setDepartmentFilter('');
		setDesignationFilter('');
		setEmploymentTypeFilter('');
		setPage(1);
	};

	// Calculate stats
	const stats = useMemo(() => {
		return {
			total: total,
			fullTime: employees.filter(e => e.employment_type_value === 'full_time' || e.employment_type === 'Full-time').length,
			departments: departments.length,
			active: employees.length // Assuming all displayed are active for now
		};
	}, [total, employees, departments]);

	return (
		<div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 min-h-screen" style={{ backgroundColor: THEME.colors.background }}>
			{/* Page Header */}
			<Card className="bg-white rounded-2xl shadow-xl border-0">
				<CardContent className="p-4 md:p-6 lg:p-8">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
						<div>
							<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
								Employee Management
							</h1>
							<p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
								Manage employees and their records
							</p>
						</div>
						<Link href="/admin/employees/new">
							<Button
								variant="primary"
								leftIcon={<UserPlus className="w-4 h-4" />}
							>
								Add Employee
							</Button>
						</Link>
					</div>
				</CardContent>
			</Card>

			{/* Quick Stats */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
				<div className="h-full">
					<AnalyticsCard
						title="Total Employees"
						value={stats.total}
						icon={Users}
						color={THEME.colors.primary}
						hoverDescription="Total registered employees"
					/>
				</div>
				<div className="h-full">
					<AnalyticsCard
						title="Full-time"
						value={stats.fullTime}
						icon={UserCheck}
						color={THEME.colors.success}
						hoverDescription="Full-time employees"
					/>
				</div>
				<div className="h-full">
					<AnalyticsCard
						title="Departments"
						value={stats.departments}
						icon={Building2}
						color={THEME.colors.medium}
						hoverDescription="Active departments"
					/>
				</div>
				<div className="h-full">
					<AnalyticsCard
						title="Designations"
						value={designations.length}
						icon={Briefcase}
						color={THEME.colors.gray}
						hoverDescription="Job positions"
					/>
				</div>
			</div>

			{/* Search & Filters */}
			<Card className="bg-white rounded-2xl shadow-xl border-0">
				<CardContent className="p-4 md:p-6">
					<div className="space-y-4">
						{/* Search Bar */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: THEME.colors.gray }} size={20} />
							<input
								type="text"
								placeholder="Search by name, email, or code..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="w-full pl-10 pr-4 py-2 md:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
								style={{
									borderColor: THEME.colors.background,
								}}
							/>
						</div>

						{/* Filter Toggle */}
						<div className="flex items-center justify-between">
							<Button
								variant="outline"
								size="sm"
								leftIcon={<Filter className="w-4 h-4" />}
								onClick={() => setShowFilters(!showFilters)}
							>
								{showFilters ? 'Hide Filters' : 'Show Filters'}
							</Button>
							<span className="text-sm" style={{ color: THEME.colors.gray }}>
								{total} employee{total !== 1 ? 's' : ''} found
							</span>
						</div>

						{/* Filters */}
						{showFilters && (
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: THEME.colors.background }}>
								{/* Department Filter */}
								<div>
									<label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
										Department
									</label>
									<select
										value={departmentFilter}
										onChange={(e) => {
											setDepartmentFilter(e.target.value);
											setPage(1);
										}}
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

								{/* Designation Filter */}
								<div>
									<label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
										Designation
									</label>
									<select
										value={designationFilter}
										onChange={(e) => {
											setDesignationFilter(e.target.value);
											setPage(1);
										}}
										className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
										style={{
											borderColor: THEME.colors.background,
										}}
									>
										<option value="">All Designations</option>
										{designations.map((desig) => (
											<option key={desig.position_code} value={desig.position_code}>
												{desig.position_name}
											</option>
										))}
									</select>
								</div>

								{/* Employment Type Filter */}
								<div>
									<label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
										Employment Type
									</label>
									<select
										value={employmentTypeFilter}
										onChange={(e) => {
											setEmploymentTypeFilter(e.target.value);
											setPage(1);
										}}
										className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
										style={{
											borderColor: THEME.colors.background,
										}}
									>
										<option value="">All Types</option>
										<option value="full_time">Full-time</option>
										<option value="part_time">Part-time</option>
										<option value="contract">Contract</option>
										<option value="intern">Intern</option>
									</select>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Employees Table */}
			<Card className="bg-white rounded-2xl shadow-xl border-0">
				<CardHeader className="p-4 md:p-6 lg:p-8 pb-2 md:pb-4">
					<CardTitle className="text-lg md:text-xl lg:text-2xl font-bold" style={{ color: THEME.colors.primary }}>
						Employees List
					</CardTitle>
				</CardHeader>
				<CardContent className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4">
					{isLoading ? (
						<div className="text-center py-12">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
							<p style={{ color: THEME.colors.gray }}>Loading employees...</p>
						</div>
					) : employees.length === 0 ? (
						<div className="text-center py-12">
							<div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: THEME.colors.background }}>
								<Users className="w-8 h-8" style={{ color: THEME.colors.gray }} />
							</div>
							<p className="text-gray-500 mb-4">No employees found</p>
							{(search || departmentFilter || employmentTypeFilter) ? (
								<Button variant="outline" onClick={clearFilters}>
									Clear Filters
								</Button>
							) : (
								<Link href="/admin/employees/new">
									<Button variant="primary">Create First Employee</Button>
								</Link>
							)}
						</div>
					) : (
						<>
							<div className="overflow-x-auto -mx-4 md:mx-0">
								<div className="inline-block min-w-full align-middle">
									<div className="overflow-hidden">
										<table className="min-w-full divide-y" style={{ borderColor: THEME.colors.background }}>
											<thead>
												<tr className="border-b-2" style={{ borderColor: THEME.colors.background }}>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Code</th>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Name</th>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Email</th>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Phone</th>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Department</th>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Designation</th>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Type</th>
													<th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>Actions</th>
												</tr>
											</thead>
											<tbody className="divide-y" style={{ borderColor: THEME.colors.background }}>
												{employees.map((emp) => (
													<tr key={emp.employee_id} className="hover:bg-gray-50 transition-colors">
														<td className="py-4 px-4 text-xs md:text-sm font-medium whitespace-nowrap" style={{ color: THEME.colors.primary }}>{emp.employee_code}</td>
														<td className="py-4 px-4">
															<div className="flex items-center gap-2">
																<div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: THEME.colors.primary }}>
																	{getInitials(emp.full_name)}
																</div>
																<span className="text-xs md:text-sm font-medium" style={{ color: THEME.colors.primary }}>
																	{emp.full_name}
																</span>
															</div>
														</td>
														<td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap" style={{ color: THEME.colors.gray }}>{emp.email}</td>
														<td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap" style={{ color: THEME.colors.gray }}>{emp.phone || '-'}</td>
														<td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap">
															{emp.department ? (
																<span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
																	{emp.department.dept_name}
																</span>
															) : '-'}
														</td>
														<td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap" style={{ color: THEME.colors.gray }}>{emp.designation?.position_name || '-'}</td>
														<td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap">
															<span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
																{emp.employment_type}
															</span>
														</td>
														<td className="py-4 px-4 whitespace-nowrap">
															<Link href={`/admin/employees/${emp.employee_id}`}>
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

							{/* Pagination */}
							{totalPages > 1 && (
								<div className="mt-6 flex items-center justify-between">
									<p className="text-sm text-gray-600">
										Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} employees
									</p>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setPage(p => Math.max(1, p - 1))}
											disabled={page === 1}
										>
											« Previous
										</Button>
										<div className="flex gap-1">
											{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
												const pageNum = i + 1;
												return (
													<Button
														key={pageNum}
														variant={page === pageNum ? 'primary' : 'outline'}
														size="sm"
														onClick={() => setPage(pageNum)}
													>
														{pageNum}
													</Button>
												);
											})}
											{totalPages > 5 && <span className="px-2">...</span>}
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setPage(p => Math.min(totalPages, p + 1))}
											disabled={page === totalPages}
										>
											Next »
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default EmployeesListPage;
