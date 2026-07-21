/**
 * useAuth Hook
 * Authentication and user management hook
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { userService, UpdateUserData } from '../services/api/userService';
import { authService } from '../services/api/authService';
import { User } from '../types';

export const useAuth = () => {
  const router = useRouter();
  const {
    user,
    token,
    isAuthenticated,
    loading,
    setUser,
    setToken,
    login: storeLogin,
    logout: storeLogout,
    setLoading,
  } = useAuthStore();

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);

      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Verify token is still valid
          try {
            const currentUser = await authService.getCurrentUser();
            if (currentUser) {
              setUser(currentUser as any);
            }
          } catch (error) {
            // Token invalid, clear auth
            storeLogout();
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        storeLogout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login function (kept for backward compatibility, but login page now uses authService directly)
   */
  const login = async (email: string, password: string, role: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await userService.login({ email, password, role });

      storeLogin(response.user, response.token);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout function - calls auth-service to blacklist token
   */
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    storeLogout();
    router.push('/login');
  };

  /**
   * Update user profile
   */
  const updateProfile = async (data: Partial<User>): Promise<boolean> => {
    if (!user) return false;

    try {
      // Convert Partial<User> to UpdateUserData format
      // Exclude avatar if it's a string (URL), only include if it's a File
      const updateData: UpdateUserData = {
        name: data.name,
        email: data.email,
        department: data.department,
        // Only include avatar if it's a File object, not a string URL
        // Since User.avatar is string | undefined, we check if it's NOT a string
        avatar: data.avatar && typeof data.avatar !== 'string' ? (data.avatar as File) : undefined,
      };

      const updatedUser = await userService.updateUser(user.id, updateData);
      setUser(updatedUser);
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  /**
   * Change password
   */
  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    try {
      await userService.changePassword(oldPassword, newPassword);
      return true;
    } catch (error) {
      console.error('Error changing password:', error);
      return false;
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    logout,
    updateProfile,
    changePassword,
  };
};

