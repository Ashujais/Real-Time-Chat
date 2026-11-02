import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; displayName: string }) => Promise<void>;
  quickLogin: (username: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chat_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('chat_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Validate token with backend on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const storedToken = localStorage.getItem('chat_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem('chat_user', JSON.stringify(data.user));
        } else {
          // Token is invalid/expired
          localStorage.removeItem('chat_token');
          localStorage.removeItem('chat_user');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Error verifying auth token:', err);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const clearError = () => setError(null);

  const login = async (identifier: string, password: string) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const register = async (formData: { username: string; email: string; password: string; displayName: string }) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const quickLogin = async (username: string) => {
    await login(username, 'password123');
  };

  const logout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setToken(null);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        quickLogin,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
