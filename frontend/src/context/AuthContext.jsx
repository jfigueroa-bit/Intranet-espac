import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { conectarSocket, desconectarSocket } from '../socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      conectarSocket();
    }
    setLoading(false);
    return () => desconectarSocket();
  }, []);

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setMustChangePassword(data.mustChangePassword);
    conectarSocket();
    return data;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    desconectarSocket();
  }

  return (
    <AuthContext.Provider
      value={{ user, setUser, login, logout, mustChangePassword, setMustChangePassword, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
