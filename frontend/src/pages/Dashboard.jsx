import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Hola, {user?.firstName} 👋</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Esta es la Fase 1 de la Intranet ESPAC: usuarios, roles, áreas, tu perfil y el
        directorio de la compañía ya están funcionando. Los demás módulos (Calendario,
        Anuncios, Documentos, Vacaciones, Chat, Programaciones, Alumnos y Solicitudes)
        se irán agregando en las siguientes fases sobre esta misma base.
      </p>
    </div>
  );
}
