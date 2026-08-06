import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { conectarSocket } from '../socket';
import { useAuth } from './AuthContext';

const DocumentsUnreadContext = createContext(null);

export function DocumentsUnreadProvider({ children }) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const refrescarPendientes = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    try {
      const { data } = await api.get('/document-drafts', { params: { rol: 'pendientes' } });
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // si falla, no rompemos el sidebar por esto
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    refrescarPendientes();

    const socket = conectarSocket();
    if (!socket) return;

    // Cualquier notificación de tipo FIRMA (te llega un documento para firmar,
    // o uno que ya quedó completo) puede cambiar tu número de pendientes,
    // así que simplemente lo volvemos a consultar para que quede exacto.
    function alRecibirNotificacion(noti) {
      if (noti.type === 'FIRMA') {
        refrescarPendientes();
      }
    }

    socket.on('notificacion:nueva', alRecibirNotificacion);
    return () => socket.off('notificacion:nueva', alRecibirNotificacion);
  }, [user, refrescarPendientes]);

  return (
    <DocumentsUnreadContext.Provider value={{ pendingCount, refrescarPendientes }}>
      {children}
    </DocumentsUnreadContext.Provider>
  );
}

export function useDocumentsUnread() {
  return useContext(DocumentsUnreadContext);
}
