"use client";
import React from 'react';

interface CNICInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export default function CNICInput({
  value = '',
  onChange,
  onBlur,
  placeholder = '12345-1234567-1',
  className,
  id,
  disabled,
}: CNICInputProps) {
  const format = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(format(e.target.value));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
      ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))
    ) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  return (
    <input
      type="text"
      id={id}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      maxLength={15}
    />
  );
}
