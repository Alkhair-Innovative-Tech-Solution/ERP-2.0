"use client";
import React from 'react';

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export default function PhoneInput({
  value = '',
  onChange,
  onBlur,
  placeholder = '0321-1234567',
  className,
  id,
  disabled,
}: PhoneInputProps) {
  const format = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
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
      type="tel"
      id={id}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      maxLength={12}
    />
  );
}
