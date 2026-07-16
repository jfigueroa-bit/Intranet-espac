import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MiPerfil from './pages/MiPerfil.jsx';
import Compania from './pages/Compania.jsx';
import Usuarios from './pages/admin/Usuarios.jsx';
import Areas from './pages/admin/Areas.jsx';
import Shell from './components/Shell.jsx';

function RutaProtegida({ children, soloAdmin = false }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (soloAdmin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
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
        <Route path="perfil" element={<MiPerfil />} />
        <Route path="compania" element={<Compania />} />
        <Route
          path="admin/usuarios"
          element={
            <RutaProtegida soloAdmin>
              <Usuarios />
            </RutaProtegida>
          }
        />
        <Route
          path="admin/areas"
          element={
            <RutaProtegida soloAdmin>
              <Areas />
            </RutaProtegida>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
