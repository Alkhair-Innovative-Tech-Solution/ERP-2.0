'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { THEME } from '../../lib/theme';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  required?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  error,
  disabled = false,
  className = '',
  fullWidth = false,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    if (!disabled && onChange) {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''} ${className}`} ref={selectRef}>
      {label && (
        <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
          {label}
          {(required || error) && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-3.5 
          border rounded-lg bg-white shadow-sm
          focus:outline-none focus:ring-2 transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 hover:shadow-md active:scale-[0.98]'}
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
        `}
        style={{
          borderColor: error ? THEME.colors.error : '#D1D5DB',
          color: '#111827',
          fontSize: '15px',
        }}
      >
        <span className={`text-base font-medium ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: error ? THEME.colors.error : THEME.colors.gray }}
        />
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-2 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto animate-scale-in"
          style={{ 
            borderColor: '#D1D5DB',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && handleSelect(option.value)}
              disabled={option.disabled}
              className={`
                w-full flex items-center justify-between px-4 py-3 
                hover:bg-gray-50 transition-all duration-150
                ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:bg-gray-100'}
                ${value === option.value ? 'bg-blue-50 font-semibold' : ''}
              `}
            >
              <span className={`text-base ${value === option.value ? 'text-gray-900' : 'text-gray-700'}`}>
                {option.label}
              </span>
              {value === option.value && (
                <Check className="w-5 h-5 animate-scale-in" style={{ color: THEME.colors.primary }} />
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-sm" style={{ color: THEME.colors.error }}>
          {error}
        </p>
      )}
    </div>
  );
};

