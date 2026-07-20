import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const ESTADO_LABEL = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada' };
const ESTADO_COLOR = { PENDIENTE: '#c9a227', APROBADA: '#2e7d32', RECHAZADA: '#b3261e' };

function Badge({ status }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: ESTADO_COLOR[status] + '22', color: ESTADO_COLOR[status],
    }}>
      {ESTADO_LABEL[status]}
    </span>
  );
}

export default function Vacaciones() {
  const { user } = useAuth();
  const puedeAprobar = ['ADMIN', 'GERENCIA', 'RRHH'].includes(user?.role);
  const puedeConfigurarDias = ['ADMIN', 'RRHH'].includes(user?.role);

  const [tab, setTab] = useState('mias');
  const [perfil, setPerfil] = useState(null);
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [formSolicitud, setFormSolicitud] = useState({ startDate: '', endDate: '', reason: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const [todas, setTodas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE');
  const [decidiendoId, setDecidiendoId] = useState(null);
  const [notaDecision, setNotaDecision] = useState('');

  const [usuarios, setUsuarios] = useState([]);
  const [diasTemp, setDiasTemp] = useState({});
  const [guardandoDiasId, setGuardandoDiasId] = useState(null);

  const [usuariosTodos, setUsuariosTodos] = useState([]);
  const esJefe = usuariosTodos.some((u) => u.managerId === user?.id);
  const puedeVerSolicitudes = puedeAprobar || esJefe;

  useEffect(() => {
    cargarMias();
    api.get('/users').then((res) => setUsuariosTodos(res.data));
  }, []);

  useEffect(() => {
    if (tab === 'solicitudes') cargarTodas();
    if (tab === 'dias') cargarUsuarios();
  }, [tab, filtroEstado]);

  async function cargarMias() {
    const [p, s] = await Promise.all([api.get('/auth/me'), api.get('/vacations')]);
    setPerfil(p.data);
    setMisSolicitudes(s.data);
  }

  async function cargarTodas() {
    const { data } = await api.get('/vacations/todas', { params: { status: filtroEstado || undefined } });
    setTodas(data);
  }

  async function cargarUsuarios() {
    const { data } = await api.get('/users');
    setUsuarios(data);
    const inicial = {};
    data.forEach((u) => { inicial[u.id] = u.vacationDaysTotal; });
    setDiasTemp(inicial);
  }

  async function enviarSolicitud(e) {
    e.preventDefault();
    setError('');
    if (!formSolicitud.startDate || !formSolicitud.endDate) {
      setError('Elige la fecha de inicio y de fin');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/vacations', formSolicitud);
      setFormSolicitud({ startDate: '', endDate: '', reason: '' });
      cargarMias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally {
      setEnviando(false);
    }
  }

  async function decidir(id, decision) {
    setError('');
    try {
      await api.patch(`/vacations/${id}/decidir`, { decision, decisionNote: notaDecision || null });
      setDecidiendoId(null);
      setNotaDecision('');
      cargarTodas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo procesar la decisión');
    }
  }

  async function eliminarSolicitud(id) {
    if (!confirm('¿Eliminar esta solicitud de vacaciones? Si ya estaba aprobada, se le devuelven los días a la persona.')) return;
    setError('');
    try {
      await api.delete(`/vacations/${id}`);
      cargarTodas();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la solicitud');
    }
  }

  async function guardarDiasTotales(id) {
    setGuardandoDiasId(id);
    try {
      await api.patch(`/users/${id}/vacaciones`, { vacationDaysTotal: Number(diasTemp[id]) });
      cargarUsuarios();
    } finally {
      setGuardandoDiasId(null);
    }
  }

  const disponibles = perfil ? perfil.vacationDaysTotal - perfil.vacationDaysUsed : 0;

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ marginTop: 0 }}>Vacaciones</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'mias' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('mias')}>
          Mis vacaciones
        </button>
        {puedeVerSolicitudes && (
          <button className={`btn ${tab === 'solicitudes' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('solicitudes')}>
            Solicitudes
          </button>
        )}
        {puedeConfigurarDias && (
          <button className={`btn ${tab === 'dias' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('dias')}>
            Días asignados
          </button>
        )}
      </div>

      {tab === 'mias' && perfil && (
        <div>
          <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 32 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Días totales</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{perfil.vacationDaysTotal}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Usados</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{perfil.vacationDaysUsed}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Disponibles</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{disponibles}</div>
            </div>
          </div>

          <form onSubmit={enviarSolicitud} className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Solicitar vacaciones</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Desde</label>
                <input type="date" value={formSolicitud.startDate} onChange={(e) => setFormSolicitud({ ...formSolicitud, startDate: e.target.value })} required />
              </div>
              <div className="field">
                <label>Hasta</label>
                <input type="date" value={formSolicitud.endDate} onChange={(e) => setFormSolicitud({ ...formSolicitud, endDate: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label>Motivo (opcional)</label>
              <input value={formSolicitud.reason} onChange={(e) => setFormSolicitud({ ...formSolicitud, reason: e.target.value })} placeholder="Ej: Viaje familiar" />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar solicitud'}</button>
          </form>

          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Mis solicitudes</h3>
            <table>
              <thead>
                <tr>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th>Días</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {misSolicitudes.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.startDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
                    <td>{new Date(s.endDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
                    <td>{s.days}</td>
                    <td>{s.reason || '—'}</td>
                    <td>
                      <Badge status={s.status} />
                      {s.status === 'RECHAZADA' && s.decisionNote && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.decisionNote}</div>
                      )}
                    </td>
                  </tr>
                ))}
                {misSolicitudes.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>Todavía no has hecho ninguna solicitud.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'solicitudes' && puedeVerSolicitudes && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['PENDIENTE', 'APROBADA', 'RECHAZADA', ''].map((s) => (
              <button
                key={s || 'todas'}
                className={`btn ${filtroEstado === s ? '' : 'secondary'}`}
                style={{ padding: '5px 14px', fontSize: 12 }}
                onClick={() => setFiltroEstado(s)}
              >
                {s ? ESTADO_LABEL[s] : 'Todas'}
              </button>
            ))}
          </div>

          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

          {todas.map((s) => (
            <div key={s.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.user.firstName} {s.user.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {s.user.cargo || 'Sin cargo'} · {new Date(s.startDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })} al{' '}
                    {new Date(s.endDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })} · {s.days} día(s)
                  </div>
                  {s.reason && <div style={{ fontSize: 13, marginTop: 6 }}>"{s.reason}"</div>}
                </div>
                <Badge status={s.status} />
              </div>

              {puedeAprobar && s.status === 'PENDIENTE' && (
                decidiendoId === s.id ? (
                  <div style={{ marginTop: 10 }}>
                    <input
                      value={notaDecision}
                      onChange={(e) => setNotaDecision(e.target.value)}
                      placeholder="Nota (opcional, ej. motivo del rechazo)"
                      style={{ marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => decidir(s.id, 'APROBADA')}>Aprobar</button>
                      <button className="btn danger" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => decidir(s.id, 'RECHAZADA')}>Rechazar</button>
                      <button className="btn secondary" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => { setDecidiendoId(null); setNotaDecision(''); }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn" style={{ marginTop: 10, padding: '5px 14px', fontSize: 12 }} onClick={() => setDecidiendoId(s.id)}>
                    Decidir
                  </button>
                )
              )}
              {s.status !== 'PENDIENTE' && s.decidedBy && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Decidido por {s.decidedBy.firstName} {s.decidedBy.lastName}
                  {s.decisionNote && ` — ${s.decisionNote}`}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <button className="btn danger" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => eliminarSolicitud(s.id)}>
                  Eliminar solicitud
                </button>
              </div>
            </div>
          ))}
          {todas.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No hay solicitudes aquí.</div>}
        </div>
      )}

      {tab === 'dias' && puedeConfigurarDias && (
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
            Cantidad de días de vacaciones al año para cada persona (se descuentan solos cuando se aprueba una solicitud).
          </p>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cargo</th>
                <th>Días totales</th>
                <th>Usados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.cargo || '—'}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={diasTemp[u.id] ?? u.vacationDaysTotal}
                      onChange={(e) => setDiasTemp((d) => ({ ...d, [u.id]: e.target.value }))}
                      style={{ width: 70 }}
                    />
                  </td>
                  <td>{u.vacationDaysUsed}</td>
                  <td>
                    <button
                      className="btn secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      disabled={guardandoDiasId === u.id}
                      onClick={() => guardarDiasTotales(u.id)}
                    >
                      {guardandoDiasId === u.id ? 'Guardando...' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
