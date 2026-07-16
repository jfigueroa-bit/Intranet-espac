import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Los módulos marcados como "proximo" se agregarán en las siguientes fases
// del proyecto. Ya están aquí para que se vea la estructura final completa.
const proximamente = [
  'Calendario',
  'Anuncios',
  'Documentos',
  'Vacaciones',
  'Chat interno',
  'Programaciones',
  'Alumnos',
  'Solicitudes',
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <div className="sidebar">
      <div className="logo">ESPAC · Intranet</div>

      <NavLink to="/" end>Inicio</NavLink>
      <NavLink to="/perfil">Mi Perfil</NavLink>
      <NavLink to="/compania">Compañía</NavLink>

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
