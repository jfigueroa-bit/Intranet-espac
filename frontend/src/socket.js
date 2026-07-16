import { io } from 'socket.io-client';

let socket = null;

export function conectarSocket() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  if (socket) return socket;

  const baseURL = import.meta.env.VITE_API_URL.replace('/api', '');
  socket = io(baseURL, { auth: { token } });
  return socket;
}

export function desconectarSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
