import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { conectarSocket } from '../socket';
import { useAuth } from './AuthContext';

const ChatUnreadContext = createContext({ unreadCount: 0, conversaciones: [], refrescarNoLeidos: () => {} });

export function ChatUnreadProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversaciones, setConversaciones] = useState([]);

  const refrescarNoLeidos = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/chats');
      setConversaciones(data);
      setUnreadCount(data.filter((c) => c.unread).length);
    } catch {
      // si falla, no interrumpimos nada por esto
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setConversaciones([]);
      return;
    }
    refrescarNoLeidos();

    const socket = conectarSocket();
    if (socket) {
      socket.on('chat:mensaje', () => refrescarNoLeidos());
    }
    return () => socket?.off('chat:mensaje');
  }, [user, refrescarNoLeidos]);

  return (
    <ChatUnreadContext.Provider value={{ unreadCount, conversaciones, refrescarNoLeidos }}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
