'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { Mail, Lock, Building, Hash, Eye, EyeOff, User } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { THEME } from '../../../lib/theme';
import { validateEmail, validatePassword } from '../../../lib/helpers';
import { API_ENDPOINTS } from '../../../lib/constants';
import { Logo } from '../../../components/ui/logo';

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    employeeCode: '',
    department: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.valid) {
        newErrors.password = passwordValidation.errors[0];
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.employeeCode.trim()) {
      newErrors.employeeCode = 'Employee code is required';
    }

    if (!formData.department.trim()) {
      newErrors.department = 'Department is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_ENDPOINTS.REGISTER}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            employee_code: formData.employeeCode,
            department: formData.department,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Registration failed');
      }

      router.push('/login?registered=true');
    } catch (err: any) {
      setErrors({ submit: err.message || 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fade-in"
      style={{ backgroundColor: THEME.colors.background }}
    >
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center animate-slide-in">
          <div className="mx-auto mb-6 flex justify-center">
            <Logo size="lg" showText={true} showSubtitle={true} />
          </div>
          <h1
            className="text-4xl font-bold uppercase tracking-wider mb-2"
            style={{
              color: THEME.colors.primary,
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            Create Account
          </h1>
          <p className="text-base" style={{ color: THEME.colors.gray }}>
            Register to access the Help Desk System
          </p>
        </div>

        {/* Form Card */}
        <div
          className="rounded-2xl p-8 shadow-xl animate-scale-in"
          style={{
            backgroundColor: THEME.colors.light,
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div className="relative">
              <User
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: THEME.colors.gray }}
              />
              <Input
                type="text"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-4 border rounded-lg focus:outline-none focus:ring-2 text-base transition-all"
                style={{
                  borderColor: errors.name ? THEME.colors.error : '#D1D5DB',
                  backgroundColor: 'white',
                  color: '#111827',
                  borderWidth: '1px'
                }}
                required
              />
              {errors.name && (
                <p className="text-sm mt-1" style={{ color: THEME.colors.error }}>
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: THEME.colors.gray }}
              />
              <Input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-4 border rounded-lg focus:outline-none focus:ring-2 text-base transition-all"
                style={{
                  borderColor: errors.email ? THEME.colors.error : '#D1D5DB',
                  backgroundColor: 'white',
                  color: '#111827',
                  borderWidth: '1px'
                }}
                required
              />
              {errors.email && (
                <p className="text-sm mt-1" style={{ color: THEME.colors.error }}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Employee Code Field */}
            <div className="relative">
              <Hash
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: THEME.colors.gray }}
              />
              <Input
                type="text"
                name="employeeCode"
                placeholder="Employee Code"
                value={formData.employeeCode}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-4 border rounded-lg focus:outline-none focus:ring-2 text-base transition-all"
                style={{
                  borderColor: errors.employeeCode ? THEME.colors.error : '#D1D5DB',
                  backgroundColor: 'white',
                  color: '#111827',
                  borderWidth: '1px'
                }}
                required
              />
              {errors.employeeCode && (
                <p className="text-sm mt-1" style={{ color: THEME.colors.error }}>
                  {errors.employeeCode}
                </p>
              )}
            </div>

            {/* Department Field */}
            <div className="relative">
              <Building
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: THEME.colors.gray }}
              />
              <Input
                type="text"
                name="department"
                placeholder="Department"
                value={formData.department}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-4 border rounded-lg focus:outline-none focus:ring-2 text-base transition-all"
                style={{
                  borderColor: errors.department ? THEME.colors.error : '#D1D5DB',
                  backgroundColor: 'white',
                  color: '#111827',
                  borderWidth: '1px'
                }}
                required
              />
              {errors.department && (
                <p className="text-sm mt-1" style={{ color: THEME.colors.error }}>
                  {errors.department}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: THEME.colors.gray }}
              />
              <Input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-12 pr-12 py-4 border rounded-lg focus:outline-none focus:ring-2 text-base transition-all"
                style={{
                  borderColor: errors.password ? THEME.colors.error : '#D1D5DB',
                  backgroundColor: 'white',
                  color: '#111827',
                  borderWidth: '1px'
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                style={{ color: THEME.colors.gray }}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              {errors.password && (
                <p className="text-sm mt-1" style={{ color: THEME.colors.error }}>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: THEME.colors.gray }}
              />
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-12 pr-12 py-4 border rounded-lg focus:outline-none focus:ring-2 text-base transition-all"
                style={{
                  borderColor: errors.confirmPassword ? THEME.colors.error : '#D1D5DB',
                  backgroundColor: 'white',
                  color: '#111827',
                  borderWidth: '1px'
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                style={{ color: THEME.colors.gray }}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              {errors.confirmPassword && (
                <p className="text-sm mt-1" style={{ color: THEME.colors.error }}>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {errors.submit && (
              <div
                className="text-center p-3 rounded-lg border"
                style={{
                  backgroundColor: THEME.colors.background,
                  borderColor: THEME.colors.error,
                  color: THEME.colors.error
                }}
              >
                {errors.submit}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              size="lg"
            >
              Register
            </Button>
          </form>

          <div className="text-center mt-6">
            <p className="text-base" style={{ color: THEME.colors.gray }}>
              Already have an account?{' '}
              <a
                href="/login"
                className="underline font-medium hover:opacity-80 transition-opacity"
                style={{ color: THEME.colors.primary }}
              >
                Login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

