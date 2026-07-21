import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { MESES, DIAS_SEMANA, aFechaLocal, generarMes } from '../utils/calendario';
import { TIPOS_SESION as TIPOS, COLOR_TIPO_SESION as COLOR_TIPO, LABEL_TIPO_SESION as LABEL_TIPO } from '../utils/programaciones';

export default function Programaciones() {
  const { user } = useAuth();
  const puedeGestionar = ['ADMIN', 'GERENCIA', 'INSTRUCTOR'].includes(user?.role);

  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());
  const [sesiones, setSesiones] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [form, setForm] = useState({ type: 'TEORIA', studentId: '', instructorId: '', startTime: '09:00', endTime: '10:00', notes: '' });
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [s, e, u] = await Promise.all([
      api.get('/schedules'),
      api.get('/students'),
      api.get('/users'),
    ]);
    setSesiones(s.data);
    setEstudiantes(e.data);
    setInstructores(u.data.filter((x) => x.role === 'INSTRUCTOR'));
  }

  const semanas = useMemo(() => generarMes(year, month), [year, month]);

  const sesionesPorDia = useMemo(() => {
    const mapa = {};
    sesiones.forEach((s) => {
      const key = aFechaLocal(s.date);
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(s);
    });
    return mapa;
  }, [sesiones]);

  const alumnosFiltrados = useMemo(() => {
    if (!busquedaAlumno.trim()) return estudiantes.slice(0, 8);
    const q = busquedaAlumno.toLowerCase();
    return estudiantes.filter((e) =>
      `${e.firstName} ${e.lastName} ${e.code}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [busquedaAlumno, estudiantes]);

  function cambiarMes(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
    setDiaSeleccionado(null);
  }

  function seleccionarDia(fecha) {
    setDiaSeleccionado(aFechaLocal(fecha));
    limpiarFormulario();
  }

  function limpiarFormulario() {
    setEditandoId(null);
    setForm({ type: 'TEORIA', studentId: '', instructorId: '', startTime: '09:00', endTime: '10:00', notes: '' });
    setBusquedaAlumno('');
    setError('');
  }

  function empezarEdicion(s) {
    setEditandoId(s.id);
    setForm({
      type: s.type, studentId: s.studentId, instructorId: s.instructorId,
      startTime: s.startTime, endTime: s.endTime, notes: s.notes || '',
    });
    setBusquedaAlumno(`${s.student.firstName} ${s.student.lastName}`);
    setError('');
  }

  async function guardarSesion(e) {
    e.preventDefault();
    setError('');
    if (!form.studentId) { setError('Elige un alumno'); return; }
    if (!form.instructorId) { setError('Elige un instructor'); return; }
    setGuardando(true);
    try {
      if (editandoId) {
        await api.patch(`/schedules/${editandoId}`, { ...form, date: diaSeleccionado });
      } else {
        await api.post('/schedules', { ...form, date: diaSeleccionado });
      }
      limpiarFormulario();
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la sesión');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarSesion(id) {
    if (!confirm('¿Eliminar esta sesión? Se notificará al instructor.')) return;
    await api.delete(`/schedules/${id}`);
    if (editandoId === id) limpiarFormulario();
    cargar();
  }

  const hoyKey = aFechaLocal(new Date());
  const sesionesDelDia = diaSeleccionado ? sesionesPorDia[diaSeleccionado] || [] : [];
  const alumnoElegido = estudiantes.find((e) => e.id === Number(form.studentId));

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Programaciones</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Sesiones de teoría, simulador y vuelo. Haz clic en un día para ver o programar sesiones.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button className="btn secondary" onClick={() => cambiarMes(-1)}>← Anterior</button>
            <h3 style={{ margin: 0 }}>{MESES[month]} {year}</h3>
            <button className="btn secondary" onClick={() => cambiarMes(1)}>Siguiente →</button>
          </div>

          <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 12 }}>
            {TIPOS.map((t) => (
              <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                {t.label}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DIAS_SEMANA.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>
                {d}
              </div>
            ))}
            {semanas.flat().map(({ fecha, delMes }, i) => {
              const key = aFechaLocal(fecha);
              const sesionesDia = sesionesPorDia[key] || [];
              const esHoy = key === hoyKey;
              const seleccionado = key === diaSeleccionado;
              return (
                <div
                  key={i}
                  onClick={() => seleccionarDia(fecha)}
                  style={{
                    minHeight: 70, padding: 6, borderRadius: 8, cursor: 'pointer',
                    border: seleccionado ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: delMes ? '#fff' : '#fafafa',
                    opacity: delMes ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: esHoy ? 700 : 400, color: esHoy ? 'var(--primary)' : 'var(--text)' }}>
                    {fecha.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {sesionesDia.slice(0, 2).map((s) => (
                      <div key={s.id} style={{ fontSize: 10, background: COLOR_TIPO[s.type], color: '#fff', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.startTime} {s.student.firstName}
                      </div>
                    ))}
                    {sesionesDia.length > 2 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{sesionesDia.length - 2} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {diaSeleccionado && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 14 }}>
              {new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>

            {sesionesDelDia.map((s) => (
              <div key={s.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_TIPO[s.type], display: 'inline-block' }} />
                  <strong style={{ fontSize: 13 }}>{LABEL_TIPO[s.type]}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.startTime}–{s.endTime}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  Alumno: {s.student.firstName} {s.student.lastName} ({s.student.code})
                </div>
                <div style={{ fontSize: 13 }}>
                  Instructor: {s.instructor.firstName} {s.instructor.lastName}
                </div>
                {s.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.notes}</div>}
                {puedeGestionar && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button className="btn secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => empezarEdicion(s)}>Editar</button>
                    <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarSesion(s.id)}>Eliminar</button>
                  </div>
                )}
              </div>
            ))}
            {sesionesDelDia.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>No hay sesiones este día.</div>
            )}

            {puedeGestionar && (
              <form onSubmit={guardarSesion} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {editandoId ? 'Editar sesión' : 'Programar sesión nueva'}
                </div>

                <div className="field">
                  <label>Tipo</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className="field" style={{ position: 'relative' }}>
                  <label>Alumno</label>
                  <input
                    value={busquedaAlumno}
                    onChange={(e) => { setBusquedaAlumno(e.target.value); setForm({ ...form, studentId: '' }); }}
                    placeholder="Buscar por nombre o código..."
                  />
                  {busquedaAlumno && !form.studentId && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 140, overflowY: 'auto' }}>
                      {alumnosFiltrados.map((al) => (
                        <div
                          key={al.id}
                          onClick={() => { setForm({ ...form, studentId: al.id }); setBusquedaAlumno(`${al.firstName} ${al.lastName}`); }}
                          style={{ padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
                        >
                          {al.firstName} {al.lastName} — {al.code}
                        </div>
                      ))}
                      {alumnosFiltrados.length === 0 && (
                        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Sin resultados</div>
                      )}
                    </div>
                  )}
                  {form.studentId && alumnoElegido && (
                    <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>✓ {alumnoElegido.firstName} {alumnoElegido.lastName}</div>
                  )}
                </div>

                <div className="field">
                  <label>Instructor</label>
                  <select value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
                    <option value="">Selecciona un instructor</option>
                    {instructores.map((i) => <option key={i.id} value={i.id}>{i.firstName} {i.lastName}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field"><label>Desde</label><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
                  <div className="field"><label>Hasta</label><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
                </div>

                <div className="field">
                  <label>Notas (opcional)</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                {error && <div className="error-text">{error}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn" disabled={guardando}>
                    {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Programar'}
                  </button>
                  {editandoId && (
                    <button type="button" className="btn secondary" onClick={limpiarFormulario}>Cancelar</button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
