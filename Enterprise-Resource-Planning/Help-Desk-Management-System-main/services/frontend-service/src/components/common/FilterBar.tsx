'use client';

import React from 'react';
import { Input } from '../ui/Input';
import { Select, SelectOption } from '../ui/Select';
import { Search, X } from 'lucide-react';
import { Button } from '../ui/Button';

export interface FilterValues {
  search: string;
  status: string;
  priority: string;
  department: string;
  dateRange: string;
}

interface FilterBarProps {
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
  statusOptions: SelectOption[];
  priorityOptions: SelectOption[];
  departmentOptions: SelectOption[];
  dateRangeOptions: SelectOption[];
  onClearFilters: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  statusOptions,
  priorityOptions,
  departmentOptions,
  dateRangeOptions,
  onClearFilters,
}) => {
  const hasActiveFilters = 
    filters.search || 
    filters.status !== 'all' || 
    filters.priority !== 'all' || 
    filters.department !== 'all' || 
    filters.dateRange !== 'all';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
      {/* Search Input */}
      <div className="w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search by title, description, or ticket ID..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm sm:text-base"
            style={{ backgroundColor: 'white', color: '#111827' }}
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Select
          options={statusOptions}
          value={filters.status}
          onChange={(value) => onFilterChange({ ...filters, status: value })}
          placeholder="All Statuses"
          className="w-full"
          fullWidth
        />
        
        <Select
          options={priorityOptions}
          value={filters.priority}
          onChange={(value) => onFilterChange({ ...filters, priority: value })}
          placeholder="All Priorities"
          className="w-full"
          fullWidth
        />
        
        <Select
          options={departmentOptions}
          value={filters.department}
          onChange={(value) => onFilterChange({ ...filters, department: value })}
          placeholder="All Departments"
          className="w-full"
          fullWidth
        />
        
        <Select
          options={dateRangeOptions}
          value={filters.dateRange}
          onChange={(value) => onFilterChange({ ...filters, dateRange: value })}
          placeholder="Date Range"
          className="w-full"
          fullWidth
        />
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            leftIcon={<X className="w-4 h-4" />}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};

export { FilterBar };
export default FilterBar;
