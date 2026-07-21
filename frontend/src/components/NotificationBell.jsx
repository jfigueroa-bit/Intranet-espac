import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { conectarSocket } from '../socket';
import { reproducirSonidoNotificacion } from '../utils/sonido';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [notis, setNotis] = useState([]);

  useEffect(() => {
    cargar();
    const socket = conectarSocket();
    if (socket) {
      socket.on('notificacion:nueva', (noti) => {
        setNotis((prev) => [noti, ...prev]);
        reproducirSonidoNotificacion();
      });
    }
    return () => socket?.off('notificacion:nueva');
  }, []);

  async function cargar() {
    const { data } = await api.get('/notifications');
    setNotis(data);
  }

  // Al abrir la campana, se marca todo como leído de una — así ya no hay que
  // ir clic por clic para que desaparezca la bolita.
  async function alternarAbierto() {
    const abriendola = !abierto;
    setAbierto(abriendola);
    if (abriendola && notis.some((n) => !n.read)) {
      setNotis((prev) => prev.map((n) => ({ ...n, read: true })));
      await api.patch('/notifications/leer-todas');
    }
  }

  function irAlLugar(n) {
    setAbierto(false);
    if (n.link) navigate(n.link);
  }

  const noLeidas = notis.filter((n) => !n.read).length;

  return (
    <div style={{ position: 'relative' }}>
      <button className="notif-bell" onClick={alternarAbierto}>
        🔔
        {noLeidas > 0 && <span className="notif-dot">{noLeidas}</span>}
      </button>

      {abierto && (
        <div className="notif-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <strong style={{ fontSize: 13 }}>Notificaciones</strong>
          </div>

          {notis.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              No tienes notificaciones.
            </div>
          )}

          {notis.map((n) => (
            <div
              key={n.id}
              className="notif-item"
              onClick={() => irAlLugar(n)}
              style={{ cursor: n.link ? 'pointer' : 'default' }}
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
