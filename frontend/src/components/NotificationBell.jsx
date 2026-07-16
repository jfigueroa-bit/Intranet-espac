import { useEffect, useState } from 'react';
import api from '../api/client';
import { conectarSocket } from '../socket';

export default function NotificationBell() {
  const [abierto, setAbierto] = useState(false);
  const [notis, setNotis] = useState([]);

  useEffect(() => {
    cargar();
    const socket = conectarSocket();
    if (socket) {
      socket.on('notificacion:nueva', (noti) => {
        setNotis((prev) => [noti, ...prev]);
      });
    }
    return () => socket?.off('notificacion:nueva');
  }, []);

  async function cargar() {
    const { data } = await api.get('/notifications');
    setNotis(data);
  }

  async function marcarLeida(id) {
    await api.patch(`/notifications/${id}/leer`);
    setNotis((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function marcarTodasLeidas() {
    await api.patch('/notifications/leer-todas');
    setNotis((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const noLeidas = notis.filter((n) => !n.read).length;

  return (
    <div style={{ position: 'relative' }}>
      <button className="notif-bell" onClick={() => setAbierto((v) => !v)}>
        🔔
        {noLeidas > 0 && <span className="notif-dot">{noLeidas}</span>}
      </button>

      {abierto && (
        <div className="notif-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <strong style={{ fontSize: 13 }}>Notificaciones</strong>
            <button
              onClick={marcarTodasLeidas}
              style={{ background: 'none', border: 'none', color: 'var(--primary-light)', fontSize: 12 }}
            >
              Marcar todas leídas
            </button>
          </div>

          {notis.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              No tienes notificaciones.
            </div>
          )}

          {notis.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.read ? '' : 'unread'}`}
              onClick={() => !n.read && marcarLeida(n.id)}
            >
              <div className="titulo">{n.title}</div>
              <div>{n.message}</div>
              <div className="fecha">{new Date(n.createdAt).toLocaleString('es-PE')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
