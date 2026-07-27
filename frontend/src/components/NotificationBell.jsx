import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { conectarSocket } from '../socket';
import { reproducirSonidoNotificacion } from '../utils/sonido';
import { activarNotificacionesPush, estaActivadoPush } from '../utils/push';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [notis, setNotis] = useState([]);
  const [pushActivo, setPushActivo] = useState(false);
  const [activandoPush, setActivandoPush] = useState(false);
  const [errorPush, setErrorPush] = useState('');

  useEffect(() => {
    cargar();
    estaActivadoPush().then(setPushActivo);

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

  async function activarPush() {
    setActivandoPush(true);
    setErrorPush('');
    try {
      await activarNotificacionesPush();
      setPushActivo(true);
    } catch (err) {
      setErrorPush(err.message || 'No se pudo activar');
    } finally {
      setActivandoPush(false);
    }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <strong style={{ fontSize: 13 }}>Notificaciones</strong>
            {!pushActivo ? (
              <button
                onClick={activarPush}
                disabled={activandoPush}
                style={{ background: 'none', border: 'none', color: 'var(--primary-light)', fontSize: 11, cursor: 'pointer' }}
              >
                {activandoPush ? 'Activando...' : 'Activar en este dispositivo'}
              </button>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--success)' }}>Push activo ✓</span>
            )}
          </div>

          {errorPush && <div className="error-text" style={{ padding: '4px 14px', fontSize: 11 }}>{errorPush}</div>}

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
