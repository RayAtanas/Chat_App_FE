// src/services/authContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginUserDto, RegisterUserDto, AuthContextType } from '../types/types';
import { authAPI } from '../services/authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from sessionStorage (tab-specific)
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        try {
          // Validate token by fetching profile
          const profile = await authAPI.getProfile();
          const userData = JSON.parse(storedUser);
          setUser({ ...userData, id: profile.userId });
        } catch (error) {
          // Token is invalid, clear storage
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginUserDto): Promise<void> => {
    try {
      setLoading(true);
      const response = await authAPI.login(credentials);
      const token = response.access_token;
      
      // Store token temporarily to make profile request
      sessionStorage.setItem('token', token);
      
      // Get user profile
      const profile = await authAPI.getProfile();
      
      const userData: User = {
        id: profile.userId,
        username: profile.username,
      };

      setToken(token);
      setUser(userData);
      sessionStorage.setItem('user', JSON.stringify(userData));
      
    } catch (error: any) {
      sessionStorage.removeItem('token');
      throw new Error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterUserDto): Promise<void> => {
    try {
      setLoading(true);
      await authAPI.register(userData);
      
      // After successful registration, log the user in
      await login({ username: userData.username, password: userData.password });
      
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
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