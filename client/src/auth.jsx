import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

// One session for either a student or a staff member. user.role is 'student', 'officer' or 'admin'.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api('/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('resolve:logout', onLogout);
    return () => window.removeEventListener('resolve:logout', onLogout);
  }, []);

  const finish = ({ token, user: u }) => {
    setToken(token);
    setUser(u);
    return u;
  };

  const login = useCallback(
    async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } })),
    []
  );
  const studentLogin = useCallback(
    async (identifier, password) => finish(await api('/students/login', { method: 'POST', body: { identifier, password } })),
    []
  );
  const register = useCallback(
    async (data) => finish(await api('/students/register', { method: 'POST', body: data })),
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const isStudent = user?.role === 'student';
  const isStaff = !!user && !isStudent;

  return (
    <AuthContext.Provider value={{ user, ready, isStudent, isStaff, login, studentLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
