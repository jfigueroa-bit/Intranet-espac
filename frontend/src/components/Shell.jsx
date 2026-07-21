import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import NotificationBell from './NotificationBell.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import ChatDock from './ChatDock.jsx';
import Reloj from './Reloj.jsx';
import { useAuth } from '../context/AuthContext';

export default function Shell() {
  const { user, mustChangePassword } = useAuth();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <Reloj />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <NotificationBell />
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {user?.firstName} {user?.lastName}
            </div>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
      <ChatDock />
      {mustChangePassword && <ChangePasswordModal obligatorio />}
    </div>
  );
}
