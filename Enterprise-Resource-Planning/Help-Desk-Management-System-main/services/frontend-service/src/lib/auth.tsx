'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Wrapper function to update both state and localStorage
  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (typeof window !== 'undefined') {
      if (newUser) {
        localStorage.setItem('user', JSON.stringify(newUser));
      } else {
        localStorage.removeItem('user');
      }
    }
  };

  // Check for stored auth on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');

        if (storedUser && storedToken) {
          setUserState(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string, role: string): Promise<boolean> => {
    try {
      // Mock login for development/testing - Always allow in dev mode
      // Check if we're in browser and allow mock login
      const isBrowser = typeof window !== 'undefined';
      const isDevelopment = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      // Allow mock login in development (any password works)
      if (isDevelopment) {
        // Mock user data based on role
        const mockUsers: Record<string, User> = {
          requestor: {
            id: '1',
            name: 'John requestor',
            email: email || 'requestor@test.com',
            role: 'requestor',
            department: 'IT',
            employeeCode: 'EMP001',
          },
          moderator: {
            id: '2',
            name: 'Sarah Moderator',
            email: email || 'moderator@test.com',
            role: 'moderator',
            department: 'IT',
            employeeCode: 'EMP002',
          },
          assignee: {
            id: '3',
            name: 'Mike Assignee',
            email: email || 'assignee@test.com',
            role: 'assignee',
            department: 'IT',
            employeeCode: 'EMP003',
          },
          admin: {
            id: '4',
            name: 'Admin User',
            email: email || 'admin@test.com',
            role: 'admin',
            department: 'IT',
            employeeCode: 'EMP004',
          },
        };

        const userData = mockUsers[role] || mockUsers.admin;
        const mockToken = `mock_token_${Date.now()}_${role}`;

        localStorage.setItem('token', mockToken);
        setUser(userData);

        console.log('Mock login successful:', { role, userData });
        return true;
      }

      // Real API call for production
      try {
        const response = await fetch(`/api/users/login/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, role }),
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();

        // Store user and token
        const userData: User = {
          id: data.user.id,
          name: data.user.name || data.user.email,
          email: data.user.email,
          role: data.user.role,
          department: data.user.department,
          avatar: data.user.avatar,
          employeeCode: data.user.employee_code,
        };

        localStorage.setItem('token', data.token || data.access);
        setUser(userData);

        return true;
      } catch (apiError) {
        console.error('API login error:', apiError);
        // Fallback to mock login if API fails in development
        if (isDevelopment) {
          const mockUsers: Record<string, User> = {
            requestor: {
              id: '1',
              name: 'John requestor',
              email: email || 'requestor@test.com',
              role: 'requestor',
              department: 'IT',
              employeeCode: 'EMP001',
            },
            moderator: {
              id: '2',
              name: 'Sarah Moderator',
              email: email || 'moderator@test.com',
              role: 'moderator',
              department: 'IT',
              employeeCode: 'EMP002',
            },
            assignee: {
              id: '3',
              name: 'Mike Assignee',
              email: email || 'assignee@test.com',
              role: 'assignee',
              department: 'IT',
              employeeCode: 'EMP003',
            },
            admin: {
              id: '4',
              name: 'Admin User',
              email: email || 'admin@test.com',
              role: 'admin',
              department: 'IT',
              employeeCode: 'EMP004',
            },
          };

          const userData = mockUsers[role] || mockUsers.admin;
          const mockToken = `mock_token_${Date.now()}_${role}`;

          localStorage.setItem('token', mockToken);
          setUser(userData);

          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUserState(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

