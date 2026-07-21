import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import NotificationBell from './NotificationBell.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import ChatDock from './ChatDock.jsx';
import Reloj from './Reloj.jsx';
import PerfilDrawer from './PerfilDrawer.jsx';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Shell() {
  const { user, mustChangePassword } = useAuth();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [foto, setFoto] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then((res) => setFoto(res.data.profilePhoto || null));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <Reloj />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <NotificationBell />
            <button
              onClick={() => setPerfilAbierto(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {foto ? (
                <img src={foto} alt="Mi foto de perfil" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {user?.firstName} {user?.lastName}
              </div>
            </button>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
      <ChatDock />
      <PerfilDrawer
        abierto={perfilAbierto}
        onCerrar={() => setPerfilAbierto(false)}
        onFotoActualizada={(dataUrl) => setFoto(dataUrl)}
      />
      {mustChangePassword && <ChangePasswordModal obligatorio />}
    </div>
  );
}
