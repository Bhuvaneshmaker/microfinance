import { createContext, useContext, useEffect, useState } from 'react';
import { refreshSession } from '../api';

const AuthContext = createContext(null);
const storageKey = 'microfinance_user';
const tokenKey = 'microfinance_token';
const inactivityLimitMs = 30 * 60 * 1000;
const lastActivityKey = 'microfinance_last_activity';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(storageKey, JSON.stringify(user));
      localStorage.setItem(lastActivityKey, Date.now().toString());
    } else {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(lastActivityKey);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    let timeoutId;
    const expireIfIdle = () => {
      const lastActivity = Number(localStorage.getItem(lastActivityKey) || 0);
      if (Date.now() - lastActivity >= inactivityLimitMs) {
        setUser(null);
      } else {
        timeoutId = window.setTimeout(expireIfIdle, inactivityLimitMs);
      }
    };
    const markActivity = () => localStorage.setItem(lastActivityKey, Date.now().toString());

    window.addEventListener('mousemove', markActivity);
    window.addEventListener('keydown', markActivity);
    window.addEventListener('click', markActivity);
    window.addEventListener('focus', markActivity);
    timeoutId = window.setTimeout(expireIfIdle, inactivityLimitMs);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('click', markActivity);
      window.removeEventListener('focus', markActivity);
    };
  }, [user]);

  useEffect(() => {
    async function refreshUser() {
      if (!localStorage.getItem(tokenKey)) return;
      try {
        const response = await refreshSession();
        localStorage.setItem(tokenKey, response.token);
        setUser(response.user);
      } catch (error) {
        setUser(null);
      }
    }
    refreshUser();
  }, []);

  const login = (userData, token) => {
    localStorage.setItem(tokenKey, token);
    setUser(userData);
  };

  const logout = () => setUser(null);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
