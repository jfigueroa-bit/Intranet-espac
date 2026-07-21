import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChatUnread } from '../context/ChatUnreadContext.jsx';

// Los módulos marcados como "proximo" se agregarán en las siguientes fases
// del proyecto. Ya están aquí para que se vea la estructura final completa.
const proximamente = [
  'Programaciones',
  'Alumnos',
  'Solicitudes',
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useChatUnread();

  return (
    <div className="sidebar">
      <div className="logo">ESPAC · Intranet</div>

      <NavLink to="/" end>Inicio</NavLink>
      <NavLink to="/anuncios">Anuncios</NavLink>
      <NavLink to="/calendario">Calendario</NavLink>
      <NavLink to="/perfil">Mi Perfil</NavLink>
      <NavLink to="/compania">Compañía</NavLink>
      <NavLink to="/documentos">Documentos</NavLink>
      <NavLink to="/vacaciones">Vacaciones</NavLink>
      <NavLink to="/chat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Chat interno</span>
        {unreadCount > 0 && (
          <span style={{
            background: 'var(--danger)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700,
            minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}>
            {unreadCount}
          </span>
        )}
      </NavLink>

      {(user?.role === 'ADMIN' || user?.role === 'RRHH') && (
        <NavLink to="/horarios">Horarios</NavLink>
      )}

      {user?.role === 'ADMIN' && (
        <>
          <div style={{ fontSize: 11, opacity: 0.6, margin: '16px 8px 4px' }}>ADMINISTRACIÓN</div>
          <NavLink to="/admin/usuarios">Usuarios</NavLink>
          <NavLink to="/admin/areas">Áreas / Tags</NavLink>
        </>
      )}

      <div style={{ fontSize: 11, opacity: 0.55, margin: '16px 8px 4px' }}>PRÓXIMAMENTE</div>
      {proximamente.map((m) => (
        <span key={m} style={{ padding: '10px 12px', fontSize: 14, opacity: 0.45 }}>
          {m}
        </span>
      ))}

      <div style={{ marginTop: 'auto' }}>
        <button className="btn secondary" style={{ width: '100%' }} onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
