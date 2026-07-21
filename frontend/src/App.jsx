import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MiPerfil from './pages/MiPerfil.jsx';
import Compania from './pages/Compania.jsx';
import Anuncios from './pages/Anuncios.jsx';
import Calendario from './pages/Calendario.jsx';
import Documentos from './pages/Documentos.jsx';
import Vacaciones from './pages/Vacaciones.jsx';
import Chat from './pages/Chat.jsx';
import Usuarios from './pages/admin/Usuarios.jsx';
import Areas from './pages/admin/Areas.jsx';
import Horarios from './pages/Horarios.jsx';
import Shell from './components/Shell.jsx';

function RutaProtegida({ children, roles = null }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RutaProtegida>
            <Shell />
          </RutaProtegida>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="anuncios" element={<Anuncios />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="perfil" element={<MiPerfil />} />
        <Route path="compania" element={<Compania />} />
        <Route path="documentos" element={<Documentos />} />
        <Route path="vacaciones" element={<Vacaciones />} />
        <Route path="chat" element={<Chat />} />
        <Route
          path="admin/usuarios"
          element={
            <RutaProtegida roles={['ADMIN']}>
              <Usuarios />
            </RutaProtegida>
          }
        />
        <Route
          path="admin/areas"
          element={
            <RutaProtegida roles={['ADMIN']}>
              <Areas />
            </RutaProtegida>
          }
        />
        <Route
          path="horarios"
          element={
            <RutaProtegida roles={['ADMIN', 'RRHH']}>
              <Horarios />
            </RutaProtegida>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
