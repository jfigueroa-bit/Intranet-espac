import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useChatUnread } from '../context/ChatUnreadContext.jsx';
import { aFechaLocal } from '../utils/calendario';

const ROLE_LABEL = {
  ADMIN: 'Administrador', GERENCIA: 'Gerencia', RRHH: 'Recursos Humanos',
  MARKETING: 'Marketing', VENTAS: 'Ventas', INSTRUCTOR: 'Instructor', EMPLEADO: 'Colaborador',
};
const TIPO_LABEL = { TEORIA: 'Teoría', SIMULADOR: 'Simulador', VUELO: 'Vuelo' };

function TarjetaPendiente({ to, titulo, valor, resaltar }) {
  return (
    <Link to={to} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: resaltar ? 'var(--danger)' : 'var(--text)', marginTop: 4 }}>{valor}</div>
    </Link>
  );
}

export default function Dashboard() {
  const { unreadCount } = useChatUnread();
  const [perfil, setPerfil] = useState(null);
  const [docsPendientes, setDocsPendientes] = useState(0);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const [eventos, setEventos] = useState([]);
  const [anuncios, setAnuncios] = useState([]);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const [resumenEquipo, setResumenEquipo] = useState(null);
  const [misSesiones, setMisSesiones] = useState(null);
  const [resumenVentas, setResumenVentas] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [me, drafts, solicitudes, ev, an] = await Promise.all([
      api.get('/auth/me'),
      api.get('/document-drafts', { params: { rol: 'pendientes' } }),
      api.get('/requests', { params: { rol: 'meSolicitan' } }),
      api.get('/events'),
      api.get('/announcements'),
    ]);

    setPerfil(me.data);
    setDocsPendientes(drafts.data.length);
    setSolicitudesPendientes(solicitudes.data.filter((s) => ['PENDIENTE', 'EN_PROCESO'].includes(s.status)).length);

    const hoyKey = aFechaLocal(new Date());
    setEventos(ev.data.filter((e) => aFechaLocal(e.date) >= hoyKey).slice(0, 4));
    setAnuncios(
      [...an.data]
        .sort((a, b) => (b.pinned === a.pinned ? new Date(b.createdAt) - new Date(a.createdAt) : b.pinned ? 1 : -1))
        .slice(0, 3)
    );

    if (['ADMIN', 'GERENCIA'].includes(me.data.role)) {
      const [usuarios, alumnos, vacacionesPend] = await Promise.all([
        api.get('/users'),
        api.get('/students'),
        api.get('/vacations/todas', { params: { status: 'PENDIENTE' } }),
      ]);
      setResumenEquipo({
        empleados: usuarios.data.length,
        alumnos: alumnos.data.length,
        vacacionesPendientes: vacacionesPend.data.length,
      });
    }

    if (me.data.role === 'INSTRUCTOR') {
      const sesiones = await api.get('/schedules', { params: { instructorId: me.data.id } });
      const hoy = aFechaLocal(new Date());
      setMisSesiones(sesiones.data.filter((s) => aFechaLocal(s.date) >= hoy).slice(0, 5));
    }

    if (me.data.role === 'VENTAS') {
      const [alumnos, cursos] = await Promise.all([api.get('/students'), api.get('/courses')]);
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const nuevosEsteMes = alumnos.data.filter((a) => new Date(a.enrollmentDate) >= inicioMes).length;
      const cursoTop = [...cursos.data].sort((a, b) => (b._count?.students || 0) - (a._count?.students || 0))[0];
      setResumenVentas({ nuevosEsteMes, cursoTop });
    }
  }

  async function cambiarEstado(workStatus) {
    setCambiandoEstado(true);
    try {
      await api.patch(`/users/${perfil.id}/estado`, { workStatus });
      const { data } = await api.get('/auth/me');
      setPerfil(data);
    } finally {
      setCambiandoEstado(false);
    }
  }

  if (!perfil) return null;

  const disponibles = perfil.vacationDaysTotal - perfil.vacationDaysUsed;
  const horaDelDia = new Date().getHours();
  const saludo = horaDelDia < 12 ? 'Buenos días' : horaDelDia < 19 ? 'Buenas tardes' : 'Buenas noches';

  const puedeVerEquipo = ['ADMIN', 'GERENCIA'].includes(perfil.role);
  const esInstructor = perfil.role === 'INSTRUCTOR';
  const esVentas = perfil.role === 'VENTAS';

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        {perfil.profilePhoto ? (
          <img src={perfil.profilePhoto} alt="Foto de perfil" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
            {perfil.firstName?.[0]}{perfil.lastName?.[0]}
          </div>
        )}
        <div>
          <h2 style={{ margin: 0 }}>Bienvenido, {perfil.firstName} 👋</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{saludo} · {perfil.cargo || ROLE_LABEL[perfil.role]}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
        Mis pendientes
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <TarjetaPendiente to="/documentos" titulo="Docs. por firmar" valor={docsPendientes} resaltar={docsPendientes > 0} />
        <TarjetaPendiente to="/solicitudes" titulo="Solicitudes" valor={solicitudesPendientes} resaltar={solicitudesPendientes > 0} />
        <TarjetaPendiente to="/chat" titulo="Chats sin leer" valor={unreadCount} resaltar={unreadCount > 0} />
        <TarjetaPendiente to="/vacaciones" titulo="Vacaciones disp." valor={disponibles} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          Mi estado actual
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`btn ${perfil.workStatus === 'PRESENCIAL' ? '' : 'secondary'}`}
            disabled={cambiandoEstado || perfil.workStatus === 'VACACIONES'}
            onClick={() => cambiarEstado('PRESENCIAL')}
          >
            Presencial
          </button>
          <button
            className={`btn ${perfil.workStatus === 'HOME_OFFICE' ? '' : 'secondary'}`}
            disabled={cambiandoEstado || perfil.workStatus === 'VACACIONES'}
            onClick={() => cambiarEstado('HOME_OFFICE')}
          >
            Home Office
          </button>
          {perfil.workStatus === 'VACACIONES' && (
            <span className="badge vacaciones">De vacaciones</span>
          )}
        </div>
      </div>

      {puedeVerEquipo && resumenEquipo && (
        <>
          <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
            Resumen del equipo
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <TarjetaPendiente to="/admin/usuarios" titulo="Empleados activos" valor={resumenEquipo.empleados} />
            <TarjetaPendiente to="/alumnos" titulo="Alumnos matriculados" valor={resumenEquipo.alumnos} />
            <TarjetaPendiente to="/vacaciones" titulo="Vacaciones por aprobar" valor={resumenEquipo.vacacionesPendientes} resaltar={resumenEquipo.vacacionesPendientes > 0} />
          </div>
        </>
      )}

      {esInstructor && (
        <>
          <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
            Tus próximas sesiones
          </h3>
          <div className="card" style={{ marginBottom: 24 }}>
            {misSesiones && misSesiones.length > 0 ? (
              misSesiones.map((s) => (
                <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <strong>{TIPO_LABEL[s.type]}</strong> — {s.student.firstName} {s.student.lastName} ·{' '}
                  {new Date(s.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, {s.startTime}–{s.endTime}
                </div>
              ))
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tienes sesiones programadas próximamente.</div>
            )}
            <Link to="/programaciones" style={{ fontSize: 12, display: 'inline-block', marginTop: 8 }}>Ver todas →</Link>
          </div>
        </>
      )}

      {esVentas && resumenVentas && (
        <>
          <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
            Resumen de ventas
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
            <TarjetaPendiente to="/alumnos" titulo="Alumnos nuevos este mes" valor={resumenVentas.nuevosEsteMes} />
            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Curso más popular</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{resumenVentas.cursoTop?.name || '—'}</div>
              {resumenVentas.cursoTop && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{resumenVentas.cursoTop._count?.students || 0} alumno(s)</div>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>Próximos eventos</strong>
            <Link to="/calendario" style={{ fontSize: 12 }}>Ver todos →</Link>
          </div>
          {eventos.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay eventos próximos.</div>}
          {eventos.map((e) => (
            <div key={e.id} style={{ marginBottom: 8, fontSize: 13 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: e.color, marginRight: 6 }} />
              <strong>{new Date(e.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</strong> — {e.title}
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>Anuncios recientes</strong>
            <Link to="/anuncios" style={{ fontSize: 12 }}>Ver todos →</Link>
          </div>
          {anuncios.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay anuncios todavía.</div>}
          {anuncios.map((a) => (
            <div key={a.id} style={{ marginBottom: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{a.pinned ? '📌 ' : ''}{a.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {a.author.firstName} {a.author.lastName} · {new Date(a.createdAt).toLocaleDateString('es-PE')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
