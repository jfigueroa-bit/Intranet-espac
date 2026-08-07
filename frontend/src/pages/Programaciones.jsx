import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { MESES, DIAS_SEMANA, aFechaLocal, generarMes } from '../utils/calendario';
import { TIPOS_SESION as TIPOS, COLOR_TIPO_SESION as COLOR_TIPO, LABEL_TIPO_SESION as LABEL_TIPO } from '../utils/programaciones';

const ICONO_TIPO = { TEORIA: '📖', SIMULADOR: '🎮', VUELO: '🛩️' };

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
  const [form, setForm] = useState({ type: 'TEORIA', studentId: '', instructorId: '', startTime: '09:00', endTime: '10:00', notes: '', aircraftTypeId: '', simulatorTypeId: '', theoryTopicId: '' });
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aircraftTypes, setAircraftTypes] = useState([]);
  const [simulatorTypes, setSimulatorTypes] = useState([]);
  const [theoryTopics, setTheoryTopics] = useState([]);

  // --- Eventos/notas de varios días (Secretaría, o quien tenga el permiso) ---
  const [puedeGestionarBloques, setPuedeGestionarBloques] = useState(false);
  const [bloques, setBloques] = useState([]);
  const [modoBloque, setModoBloque] = useState(false);
  const [diasBloqueSeleccionados, setDiasBloqueSeleccionados] = useState([]);
  const [formBloque, setFormBloque] = useState({ title: '', description: '' });
  const [editandoBloqueId, setEditandoBloqueId] = useState(null);
  const [guardandoBloque, setGuardandoBloque] = useState(false);
  const [errorBloque, setErrorBloque] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [s, e, u, av, sim, temas, b, yo] = await Promise.all([
      api.get('/schedules'),
      api.get('/students'),
      api.get('/users'),
      api.get('/aircraft-types'),
      api.get('/simulator-types'),
      api.get('/theory-topics'),
      api.get('/schedules/bloques'),
      api.get('/auth/me'),
    ]);
    setSesiones(s.data);
    setEstudiantes(e.data);
    setInstructores(u.data.filter((x) => x.role === 'INSTRUCTOR'));
    setAircraftTypes(av.data);
    setSimulatorTypes(sim.data);
    setTheoryTopics(temas.data);
    setBloques(b.data);
    setPuedeGestionarBloques(yo.data.role === 'ADMIN' || !!yo.data.canManageScheduleBlocks);
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

  const bloquesPorDia = useMemo(() => {
    const mapa = {};
    bloques.forEach((b) => {
      (b.dates || []).forEach((fecha) => {
        if (!mapa[fecha]) mapa[fecha] = [];
        mapa[fecha].push(b);
      });
    });
    return mapa;
  }, [bloques]);

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
    setForm({ type: 'TEORIA', studentId: '', instructorId: '', startTime: '09:00', endTime: '10:00', notes: '', aircraftTypeId: '', simulatorTypeId: '', theoryTopicId: '' });
    setBusquedaAlumno('');
    setError('');
  }

  function empezarEdicion(s) {
    setEditandoId(s.id);
    setForm({
      type: s.type, studentId: s.studentId, instructorId: s.instructorId,
      startTime: s.startTime, endTime: s.endTime, notes: s.notes || '',
      aircraftTypeId: '', simulatorTypeId: '', theoryTopicId: '',
    });
    setBusquedaAlumno(`${s.student.firstName} ${s.student.lastName}`);
    setError('');
  }

  function calcularHoras(inicio, fin) {
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(minutos, 0) / 60;
  }

  async function guardarSesion(e) {
    e.preventDefault();
    setError('');
    if (!form.studentId) { setError('Elige un alumno'); return; }
    if (!form.instructorId) { setError('Elige un instructor'); return; }
    if (!editandoId && form.type === 'VUELO' && !form.aircraftTypeId) { setError('Elige el tipo de avión'); return; }
    if (!editandoId && form.type === 'SIMULADOR' && !form.simulatorTypeId) { setError('Elige el tipo de simulador'); return; }
    if (!editandoId && form.type === 'TEORIA' && !form.theoryTopicId) { setError('Elige el tema de teoría'); return; }
    setGuardando(true);
    try {
      if (editandoId) {
        await api.patch(`/schedules/${editandoId}`, { ...form, date: diaSeleccionado });
      } else {
        await api.post('/schedules', { ...form, date: diaSeleccionado });

        const horas = calcularHoras(form.startTime, form.endTime);
        if (form.type === 'VUELO') {
          await api.post('/flight-logs', {
            studentId: form.studentId,
            aircraftTypeId: form.aircraftTypeId,
            hours: horas,
            date: diaSeleccionado,
            notes: form.notes || 'Registrado desde Programaciones',
          });
        }
        if (form.type === 'SIMULADOR') {
          await api.post('/simulator-logs', {
            studentId: form.studentId,
            simulatorTypeId: form.simulatorTypeId,
            hours: horas,
            date: diaSeleccionado,
            notes: form.notes || 'Registrado desde Programaciones',
          });
        }
        if (form.type === 'TEORIA') {
          await api.post('/theory-logs', {
            studentId: form.studentId,
            theoryTopicId: form.theoryTopicId,
            hours: horas,
            date: diaSeleccionado,
            notes: form.notes || 'Registrado desde Programaciones',
          });
        }
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

  function activarModoBloque() {
    setModoBloque(true);
    setDiasBloqueSeleccionados([]);
    setEditandoBloqueId(null);
    setFormBloque({ title: '', description: '' });
    setErrorBloque('');
  }

  function cancelarModoBloque() {
    setModoBloque(false);
    setDiasBloqueSeleccionados([]);
    setEditandoBloqueId(null);
    setFormBloque({ title: '', description: '' });
    setErrorBloque('');
  }

  function alternarDiaBloque(fecha) {
    const key = aFechaLocal(fecha);
    setDiasBloqueSeleccionados((dias) =>
      dias.includes(key) ? dias.filter((d) => d !== key) : [...dias, key].sort()
    );
  }

  function empezarEdicionBloque(b) {
    setModoBloque(true);
    setEditandoBloqueId(b.id);
    setDiasBloqueSeleccionados([...b.dates].sort());
    setFormBloque({ title: b.title, description: b.description || '' });
    setErrorBloque('');
  }

  async function guardarBloque(e) {
    e.preventDefault();
    setErrorBloque('');
    if (!formBloque.title.trim()) { setErrorBloque('Ponle un título al evento'); return; }
    if (diasBloqueSeleccionados.length === 0) { setErrorBloque('Selecciona al menos un día en el calendario'); return; }
    setGuardandoBloque(true);
    try {
      if (editandoBloqueId) {
        await api.patch(`/schedules/bloques/${editandoBloqueId}`, {
          title: formBloque.title, description: formBloque.description, dates: diasBloqueSeleccionados,
        });
      } else {
        await api.post('/schedules/bloques', {
          title: formBloque.title, description: formBloque.description, dates: diasBloqueSeleccionados,
        });
      }
      cancelarModoBloque();
      cargar();
    } catch (err) {
      setErrorBloque(err.response?.data?.error || 'No se pudo guardar el evento');
    } finally {
      setGuardandoBloque(false);
    }
  }

  async function eliminarBloque(id) {
    if (!confirm('¿Eliminar este evento de varios días?')) return;
    await api.delete(`/schedules/bloques/${id}`);
    if (editandoBloqueId === id) cancelarModoBloque();
    cargar();
  }

  const hoyKey = aFechaLocal(new Date());
  const sesionesDelDia = diaSeleccionado ? sesionesPorDia[diaSeleccionado] || [] : [];
  const bloquesDelDia = diaSeleccionado ? bloquesPorDia[diaSeleccionado] || [] : [];
  const alumnoElegido = estudiantes.find((e) => e.id === Number(form.studentId));

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🗓️ Programaciones</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Sesiones de teoría, simulador y vuelo. Haz clic en un día para ver o programar sesiones.
      </p>

      {puedeGestionarBloques && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          {!modoBloque ? (
            <button className="btn secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={activarModoBloque}>
              📌 Seleccionar varios días para un evento
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              📌 Modo de selección activo — haz clic en los días del calendario para agregarlos o quitarlos.
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button className="btn secondary" onClick={() => cambiarMes(-1)}>← Anterior</button>
            <h3 style={{ margin: 0 }}>{MESES[month]} {year}</h3>
            <button className="btn secondary" onClick={() => cambiarMes(1)}>Siguiente →</button>
          </div>

          <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 12, flexWrap: 'wrap' }}>
            {TIPOS.map((t) => (
              <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{ICONO_TIPO[t.value]}</span>
                {t.label}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>📌</span>
              Evento de varios días
            </div>
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
              const bloquesDia = bloquesPorDia[key] || [];
              const esHoy = key === hoyKey;
              const seleccionado = key === diaSeleccionado;
              const enBloque = diasBloqueSeleccionados.includes(key);
              return (
                <div
                  key={i}
                  onClick={() => (modoBloque ? alternarDiaBloque(fecha) : seleccionarDia(fecha))}
                  style={{
                    minHeight: 70, padding: 6, borderRadius: 8, cursor: 'pointer',
                    border: enBloque ? '2px solid #e0a013' : seleccionado ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: enBloque ? '#fff8ea' : delMes ? '#fff' : '#fafafa',
                    opacity: delMes ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: esHoy ? 700 : 400, color: esHoy ? 'var(--primary)' : 'var(--text)' }}>
                    {fecha.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {bloquesDia.slice(0, 1).map((b) => (
                      <div key={`b-${b.id}`} style={{ fontSize: 10, background: '#e0a013', color: '#fff', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📌 {b.title}
                      </div>
                    ))}
                    {sesionesDia.slice(0, 2).map((s) => (
                      <div key={s.id} style={{ fontSize: 10, background: COLOR_TIPO[s.type], color: '#fff', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ICONO_TIPO[s.type]} {s.startTime} {s.student.firstName}
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

        {modoBloque ? (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 14 }}>📌 {editandoBloqueId ? 'Editar evento de varios días' : 'Nuevo evento de varios días'}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Haz clic en los días del calendario para agregarlos o quitarlos del evento.
            </p>

            <div style={{ fontSize: 13, marginBottom: 10 }}>
              {diasBloqueSeleccionados.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>Ningún día seleccionado todavía.</span>
              ) : (
                <>
                  <strong>{diasBloqueSeleccionados.length}</strong> día{diasBloqueSeleccionados.length === 1 ? '' : 's'} seleccionado{diasBloqueSeleccionados.length === 1 ? '' : 's'}:{' '}
                  {diasBloqueSeleccionados.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })).join(', ')}
                </>
              )}
            </div>

            <form onSubmit={guardarBloque}>
              <div className="field">
                <label>Título</label>
                <input value={formBloque.title} onChange={(e) => setFormBloque({ ...formBloque, title: e.target.value })} placeholder="Ej: Semana de exámenes" required />
              </div>
              <div className="field">
                <label>Descripción (opcional)</label>
                <textarea
                  value={formBloque.description}
                  onChange={(e) => setFormBloque({ ...formBloque, description: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {errorBloque && <div className="error-text">{errorBloque}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn" disabled={guardandoBloque}>
                  {guardandoBloque ? 'Guardando...' : editandoBloqueId ? 'Guardar cambios' : 'Guardar evento'}
                </button>
                <button type="button" className="btn secondary" onClick={cancelarModoBloque}>Cancelar</button>
              </div>
            </form>
          </div>
        ) : diaSeleccionado && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 14 }}>
              📅 {new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>

            {bloquesDelDia.map((b) => (
              <div key={`bloque-${b.id}`} className="card" style={{ marginBottom: 10, borderLeft: '4px solid #e0a013' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>📌</span>
                  <strong style={{ fontSize: 13 }}>{b.title}</strong>
                </div>
                {b.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{b.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Creado por {b.createdBy.firstName} {b.createdBy.lastName}
                </div>
                {(puedeGestionarBloques && (user?.role === 'ADMIN' || b.createdBy.id === user?.id)) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button className="btn secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => empezarEdicionBloque(b)}>Editar</button>
                    <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarBloque(b.id)}>Eliminar</button>
                  </div>
                )}
              </div>
            ))}

            {sesionesDelDia.map((s) => (
              <div key={s.id} className="card" style={{ marginBottom: 10, borderLeft: `4px solid ${COLOR_TIPO[s.type]}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{ICONO_TIPO[s.type]}</span>
                  <strong style={{ fontSize: 13 }}>{LABEL_TIPO[s.type]}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.startTime}–{s.endTime}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  🎓 {s.student.firstName} {s.student.lastName} ({s.student.code})
                </div>
                <div style={{ fontSize: 13 }}>
                  👤 {s.instructor.firstName} {s.instructor.lastName}
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
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Sin sesiones este día.</div>
            )}

            {puedeGestionar && (
              <form onSubmit={guardarSesion} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  {editandoId ? '✏️ Editar sesión' : '+ Programar sesión nueva'}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Tipo</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {TIPOS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm({ ...form, type: t.value })}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          border: form.type === t.value ? `2px solid ${t.color}` : '2px solid var(--border)',
                          background: form.type === t.value ? `${t.color}14` : '#fff',
                          color: form.type === t.value ? t.color : 'var(--text)',
                        }}
                      >
                        <div style={{ fontSize: 16, marginBottom: 2 }}>{ICONO_TIPO[t.value]}</div>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!editandoId && form.type === 'TEORIA' && (
                  <div className="field">
                    <label>Tema de teoría</label>
                    <select value={form.theoryTopicId} onChange={(e) => setForm({ ...form, theoryTopicId: e.target.value })}>
                      <option value="">Selecciona el tema</option>
                      {theoryTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                {!editandoId && form.type === 'VUELO' && (
                  <div className="field">
                    <label>Tipo de avión</label>
                    <select value={form.aircraftTypeId} onChange={(e) => setForm({ ...form, aircraftTypeId: e.target.value })}>
                      <option value="">Selecciona el tipo de avión</option>
                      {aircraftTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                {!editandoId && form.type === 'SIMULADOR' && (
                  <div className="field">
                    <label>Tipo de simulador</label>
                    <select value={form.simulatorTypeId} onChange={(e) => setForm({ ...form, simulatorTypeId: e.target.value })}>
                      <option value="">Selecciona el tipo de simulador</option>
                      {simulatorTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

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
                {!editandoId && (form.type === 'VUELO' || form.type === 'SIMULADOR' || form.type === 'TEORIA') && (
                  <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 6 }}>
                    ✓ Esto también sumará las horas al historial de {form.type === 'VUELO' ? 'Vuelo' : form.type === 'SIMULADOR' ? 'Simulador' : 'Tierra'} del alumno, en Alumnos → Horas.
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
