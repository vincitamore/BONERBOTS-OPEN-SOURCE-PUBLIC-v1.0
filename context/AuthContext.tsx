/**
 * Authentication Context
 * Manages user authentication state and JWT tokens
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiBaseUrl } from '../utils/apiConfig';

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<string>; // Returns recovery phrase
  logout: () => Promise<void>;
  recoverAccount: (username: string, recoveryPhrase: string) => Promise<void>;
  resetPassword: (username: string, recoveryPhrase: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = getApiBaseUrl();

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedRefreshToken = localStorage.getItem('auth_refresh_token');
    const storedUser = localStorage.getItem('auth_user');

    // Handle edge case where localStorage has string "null" instead of actual null
    const validToken = storedToken && storedToken !== 'null' && storedToken !== 'undefined' ? storedToken : null;
    const validRefreshToken = storedRefreshToken && storedRefreshToken !== 'null' && storedRefreshToken !== 'undefined' ? storedRefreshToken : null;
    const validUser = storedUser && storedUser !== 'null' && storedUser !== 'undefined' ? storedUser : null;

    if (validToken && validUser) {
      setToken(validToken);
      setRefreshToken(validRefreshToken);
      setUser(JSON.parse(validUser));
    } else {
      // Clean up invalid localStorage entries
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('auth_user');
    }

    setIsLoading(false);
  }, []);

  const register = async (username: string, password: string, email?: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();

      // DO NOT auto-login here - user must see recovery phrase first!
      // They will be redirected to login page after confirming they saved it

      // Return recovery phrase - CRITICAL: User must save this!
      return data.recoveryPhrase;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();

      // Store tokens and user info
      localStorage.setItem('auth_token', data.accessToken);
      localStorage.setItem('auth_refresh_token', data.refreshToken);
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('auth_user');
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  };

  const recoverAccount = async (username: string, recoveryPhrase: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, recoveryPhrase }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Account recovery failed');
      }

      // Recovery successful - phrase is valid
    } catch (error) {
      console.error('Account recovery error:', error);
      throw error;
    }
  };

  const resetPassword = async (username: string, recoveryPhrase: string, newPassword: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, recoveryPhrase, newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Password reset failed');
      }

      // Password reset successful - user needs to login with new password
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Profile update failed');
      }

      const data = await response.json();
      
      // Update stored user info
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Password change failed');
      }
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  };

  const value = {
    user,
    token,
    refreshToken,
    login,
    register,
    logout,
    recoverAccount,
    resetPassword,
    updateProfile,
    changePassword,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

