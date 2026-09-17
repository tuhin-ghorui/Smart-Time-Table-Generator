import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ct_user') || 'null');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('ct_token')));

  useEffect(() => {
    if (!localStorage.getItem('ct_token')) return;
    api
      .get('/auth/me')
      .then((res) => {
        localStorage.setItem('ct_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('ct_token', res.data.token);
    localStorage.setItem('ct_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    setUser(null);
  };

  const value = useMemo(() => ({ user, setUser, login, logout, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}