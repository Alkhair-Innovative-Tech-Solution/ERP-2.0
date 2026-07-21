'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { THEME } from '../../lib/theme';

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export default function DebouncedInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: THEME.colors.gray }} />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        style={{
          backgroundColor: 'white',
          color: '#111827',
        }}
      />
    </div>
  );
}

