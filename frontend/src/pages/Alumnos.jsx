import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TIPOS_SESION, COLOR_TIPO_SESION, LABEL_TIPO_SESION } from '../utils/programaciones';
import { construirEstadoCuentaHTML } from '../utils/estadoCuenta';
import { construirReporteHorasHTML } from '../utils/reporteHoras';
import { construirBoletaPagoHTML } from '../utils/boletaPago';
import Modal from '../components/Modal.jsx';

function normalizar(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

const MAPA_COLUMNAS = {
  nombre: 'firstName', nombres: 'firstName', firstname: 'firstName',
  apellido: 'lastName', apellidos: 'lastName', lastname: 'lastName',
  correo: 'email', email: 'email', correoelectronico: 'email',
  telefono: 'phone', celular: 'phone', phone: 'phone',
  curso: 'course', course: 'course',
  fechadeingreso: 'enrollmentDate', fechaingreso: 'enrollmentDate', fechamatricula: 'enrollmentDate', enrollmentdate: 'enrollmentDate',
  horastierra: 'groundCourseHours', horascursoentierra: 'groundCourseHours', groundcoursehours: 'groundCourseHours',
  horasvuelo: 'flightHours', flighthours: 'flightHours',
  horassimulador: 'simulatorHours', simulatorhours: 'simulatorHours',
};

function filaAObjeto(filaExcel) {
  const obj = {};
  Object.entries(filaExcel).forEach(([encabezado, valor]) => {
    const clave = MAPA_COLUMNAS[normalizar(encabezado)];
    if (!clave) return;
    if (valor instanceof Date) {
      obj[clave] = valor.toISOString().slice(0, 10);
    } else {
      obj[clave] = typeof valor === 'string' ? valor.trim() : valor;
    }
  });
  return obj;
}

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'cursos', label: 'Cursos' },
  { value: 'horas', label: 'Horas' },
  { value: 'programar', label: 'Programar' },
  { value: 'pagos', label: 'Pagos' },
];

const SIMBOLO_MONEDA = { PEN: 'S/', USD: '$' };

export default function Alumnos() {
  const { user } = useAuth();
  const esAdmin = user?.role === 'ADMIN';
  const puedeGestionar = ['ADMIN', 'GERENCIA', 'VENTAS'].includes(user?.role);
  const puedeEditarHoras = puedeGestionar || user?.role === 'INSTRUCTOR';
  const puedeGestionarProgramaciones = ['ADMIN', 'GERENCIA', 'INSTRUCTOR'].includes(user?.role);

  const [tab, setTab] = useState('lista');
  const [alumnos, setAlumnos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [edit, setEdit] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [tabFicha, setTabFicha] = useState('general');

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ firstName: '', lastName: '', email: '', phone: '', courseId: '', enrollmentDate: new Date().toISOString().slice(0, 10) });

  const [filasImportar, setFilasImportar] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);

  const [nuevoCurso, setNuevoCurso] = useState('');

  const [sesionesAlumno, setSesionesAlumno] = useState([]);
  const [cargandoSesiones, setCargandoSesiones] = useState(false);

  const [inscripciones, setInscripciones] = useState([]);
  const [cargandoInscripciones, setCargandoInscripciones] = useState(false);
  const [nuevaInscripcionCurso, setNuevaInscripcionCurso] = useState('');

  const [puedeVerPagos, setPuedeVerPagos] = useState(false);
  const [cuotas, setCuotas] = useState([]);
  const [cargandoCuotas, setCargandoCuotas] = useState(false);
  const [nuevaCuota, setNuevaCuota] = useState({ concept: '', amount: '', currency: 'PEN', dueDate: '' });
  const [mostrarNuevaCuota, setMostrarNuevaCuota] = useState(false);

  const [nuevaSesion, setNuevaSesion] = useState({ type: 'TEORIA', instructorId: '', fecha: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '10:00', notes: '' });
  const [guardandoSesion, setGuardandoSesion] = useState(false);

  useEffect(() => {
    cargarCursos();
    api.get('/users').then((res) => setInstructores(res.data.filter((u) => u.role === 'INSTRUCTOR')));
    api.get('/auth/me').then((res) => {
      setPuedeVerPagos(res.data.canViewPayments || ['ADMIN', 'GERENCIA'].includes(res.data.role));
    });
  }, []);
  useEffect(() => { cargarAlumnos(); }, [busqueda]);

  async function cargarAlumnos() {
    const { data } = await api.get('/students', { params: { q: busqueda || undefined } });
    setAlumnos(data);
  }

  async function cargarCursos() {
    const { data } = await api.get('/courses');
    setCursos(data);
  }

  function abrirFicha(alumno) {
    setSeleccionado(alumno);
    setTabFicha('general');
    setEdit({
      firstName: alumno.firstName, lastName: alumno.lastName,
      email: alumno.email || '', phone: alumno.phone || '',
      courseId: alumno.courseId || '',
      enrollmentDate: alumno.enrollmentDate ? alumno.enrollmentDate.slice(0, 10) : '',
      groundCourseHours: alumno.groundCourseHours, flightHours: alumno.flightHours, simulatorHours: alumno.simulatorHours,
      notes: alumno.notes || '',
    });
    setError('');
    cargarSesionesAlumno(alumno.id);
    cargarInscripciones(alumno.id);
    if (puedeVerPagos) cargarCuotasAlumno(alumno.id);
  }

  function cerrarFicha() {
    setSeleccionado(null);
  }

  async function cargarSesionesAlumno(studentId) {
    setCargandoSesiones(true);
    try {
      const { data } = await api.get('/schedules', { params: { studentId } });
      setSesionesAlumno(data);
    } finally {
      setCargandoSesiones(false);
    }
  }

  async function eliminarSesionAlumno(id) {
    if (!confirm('¿Eliminar esta sesión programada? Se notificará al instructor.')) return;
    await api.delete(`/schedules/${id}`);
    cargarSesionesAlumno(seleccionado.id);
  }

  async function programarSesion(e) {
    e.preventDefault();
    setError('');
    if (!nuevaSesion.instructorId) { setError('Elige un instructor'); return; }
    setGuardandoSesion(true);
    try {
      await api.post('/schedules', {
        type: nuevaSesion.type,
        date: nuevaSesion.fecha,
        startTime: nuevaSesion.startTime,
        endTime: nuevaSesion.endTime,
        notes: nuevaSesion.notes,
        studentId: seleccionado.id,
        instructorId: nuevaSesion.instructorId,
      });
      setNuevaSesion({ type: 'TEORIA', instructorId: '', fecha: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '10:00', notes: '' });
      cargarSesionesAlumno(seleccionado.id);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo programar la sesión');
    } finally {
      setGuardandoSesion(false);
    }
  }

  async function cargarInscripciones(studentId) {
    setCargandoInscripciones(true);
    try {
      const { data } = await api.get('/student-courses', { params: { studentId } });
      setInscripciones(data);
    } finally {
      setCargandoInscripciones(false);
    }
  }

  async function inscribirEnCurso(e) {
    e.preventDefault();
    if (!nuevaInscripcionCurso) return;
    await api.post('/student-courses', { studentId: seleccionado.id, courseId: nuevaInscripcionCurso });
    setNuevaInscripcionCurso('');
    cargarInscripciones(seleccionado.id);
  }

  async function alternarEstadoInscripcion(insc) {
    await api.patch(`/student-courses/${insc.id}`, { status: insc.status === 'COMPLETADO' ? 'EN_CURSO' : 'COMPLETADO' });
    cargarInscripciones(seleccionado.id);
  }

  async function eliminarInscripcion(id) {
    if (!confirm('¿Quitar este curso del historial del alumno?')) return;
    await api.delete(`/student-courses/${id}`);
    cargarInscripciones(seleccionado.id);
  }

  async function cargarCuotasAlumno(studentId) {
    setCargandoCuotas(true);
    try {
      const { data } = await api.get('/payments', { params: { studentId } });
      setCuotas(data);
    } catch {
      setCuotas([]);
    } finally {
      setCargandoCuotas(false);
    }
  }

  async function crearCuota(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/payments', { ...nuevaCuota, studentId: seleccionado.id });
      setNuevaCuota({ concept: '', amount: '', currency: 'PEN', dueDate: '' });
      setMostrarNuevaCuota(false);
      cargarCuotasAlumno(seleccionado.id);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la cuota');
    }
  }

  async function alternarPagada(cuota) {
    await api.patch(`/payments/${cuota.id}`, { marcarPagada: !cuota.paidDate });
    cargarCuotasAlumno(seleccionado.id);
  }

  async function eliminarCuota(id) {
    if (!confirm('¿Eliminar esta cuota?')) return;
    await api.delete(`/payments/${id}`);
    cargarCuotasAlumno(seleccionado.id);
  }

  function verEstadoDeCuenta() {
    const html = construirEstadoCuentaHTML({ alumno: seleccionado, cuotas });
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
  }

  function verBoletaPago(cuota) {
    const html = construirBoletaPagoHTML({ alumno: seleccionado, cuota });
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
  }

  function verReporteHoras() {
    const html = construirReporteHorasHTML({ alumno: seleccionado, sesiones: sesionesAlumno });
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
  }

  async function guardarFicha() {
    setGuardando(true);
    setError('');
    try {
      const { data } = await api.patch(`/students/${seleccionado.id}`, {
        ...edit,
        courseId: edit.courseId || null,
      });
      setSeleccionado(data);
      cargarAlumnos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarAlumno(id) {
    if (!confirm('¿Eliminar a este alumno? Esta acción no se puede deshacer, y también se eliminarán sus sesiones programadas.')) return;
    setError('');
    try {
      await api.delete(`/students/${id}`);
      cerrarFicha();
      cargarAlumnos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar el alumno');
    }
  }

  async function crearAlumno(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/students', { ...nuevo, courseId: nuevo.courseId || null });
      setNuevo({ firstName: '', lastName: '', email: '', phone: '', courseId: '', enrollmentDate: new Date().toISOString().slice(0, 10) });
      setMostrarNuevo(false);
      cargarAlumnos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el alumno');
    }
  }

  function elegirExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResultadoImport(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja);
      setFilasImportar(filas.map(filaAObjeto).filter((f) => f.firstName && f.lastName));
    };
    reader.readAsBinaryString(file);
  }

  async function confirmarImportacion() {
    setImportando(true);
    try {
      const { data } = await api.post('/students/importar', { alumnos: filasImportar });
      setResultadoImport(data);
      setFilasImportar(null);
      cargarAlumnos();
      cargarCursos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo importar el archivo');
    } finally {
      setImportando(false);
    }
  }

  async function crearCurso(e) {
    e.preventDefault();
    if (!nuevoCurso.trim()) return;
    await api.post('/courses', { name: nuevoCurso });
    setNuevoCurso('');
    cargarCursos();
  }

  async function eliminarCurso(id) {
    if (!confirm('¿Eliminar este curso? Los alumnos que lo tenían quedan sin curso asignado.')) return;
    await api.delete(`/courses/${id}`);
    cargarCursos();
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Alumnos</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'lista' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('lista')}>
          Lista de alumnos
        </button>
        {esAdmin && (
          <button className={`btn ${tab === 'cursos' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('cursos')}>
            Cursos
          </button>
        )}
      </div>

      {tab === 'lista' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, apellido o código..."
                style={{ flex: 1, minWidth: 200 }}
              />
              {puedeGestionar && (
                <>
                  <button className="btn secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setMostrarNuevo((v) => !v)}>
                    + Nuevo alumno
                  </button>
                  <label className="btn secondary" style={{ padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
                    Cargar desde Excel
                    <input type="file" accept=".xlsx,.xls" onChange={elegirExcel} style={{ display: 'none' }} />
                  </label>
                </>
              )}
            </div>

            {mostrarNuevo && (
              <form onSubmit={crearAlumno} style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field"><label>Nombre(s)</label><input value={nuevo.firstName} onChange={(e) => setNuevo({ ...nuevo, firstName: e.target.value })} required /></div>
                  <div className="field"><label>Apellido</label><input value={nuevo.lastName} onChange={(e) => setNuevo({ ...nuevo, lastName: e.target.value })} required /></div>
                  <div className="field"><label>Correo (opcional)</label><input value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></div>
                  <div className="field"><label>Teléfono (opcional)</label><input value={nuevo.phone} onChange={(e) => setNuevo({ ...nuevo, phone: e.target.value })} /></div>
                  <div className="field"><label>Fecha de ingreso</label><input type="date" value={nuevo.enrollmentDate} onChange={(e) => setNuevo({ ...nuevo, enrollmentDate: e.target.value })} required /></div>
                  <div className="field">
                    <label>Curso (opcional)</label>
                    <select value={nuevo.courseId} onChange={(e) => setNuevo({ ...nuevo, courseId: e.target.value })}>
                      <option value="">Sin curso</option>
                      {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                {error && <div className="error-text">{error}</div>}
                <button className="btn" style={{ marginTop: 10 }}>Matricular alumno</button>
              </form>
            )}

            {filasImportar && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <p style={{ fontSize: 13, marginTop: 0 }}>
                  Se encontraron <strong>{filasImportar.length}</strong> fila(s) válidas (con nombre y apellido) en el archivo.
                  Columnas reconocidas: Nombre, Apellido, Correo, Teléfono, Curso, Fecha de Ingreso, Horas Tierra, Horas Vuelo, Horas Simulador.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" disabled={importando} onClick={confirmarImportacion}>
                    {importando ? 'Importando...' : `Confirmar importación de ${filasImportar.length} alumno(s)`}
                  </button>
                  <button className="btn secondary" onClick={() => setFilasImportar(null)}>Cancelar</button>
                </div>
              </div>
            )}

            {resultadoImport && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <div style={{ color: 'var(--success)' }}>✓ {resultadoImport.creados} alumno(s) importado(s) correctamente.</div>
                {resultadoImport.errores.length > 0 && (
                  <div style={{ color: 'var(--danger)', marginTop: 4 }}>
                    {resultadoImport.errores.length} fila(s) con problemas: {resultadoImport.errores.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Curso</th>
                  <th>Fecha de ingreso</th>
                  <th>Hrs. tierra</th>
                  <th>Hrs. vuelo</th>
                  <th>Hrs. simulador</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a) => (
                  <tr key={a.id} onClick={() => abrirFicha(a)} style={{ cursor: 'pointer' }}>
                    <td>{a.code}</td>
                    <td>{a.firstName} {a.lastName}</td>
                    <td>{a.course?.name || '—'}</td>
                    <td>{new Date(a.enrollmentDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
                    <td>{a.groundCourseHours}</td>
                    <td>{a.flightHours}</td>
                    <td>{a.simulatorHours}</td>
                  </tr>
                ))}
                {alumnos.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No se encontraron alumnos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cursos' && esAdmin && (
        <div>
          <form onSubmit={crearCurso} className="card" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <input value={nuevoCurso} onChange={(e) => setNuevoCurso(e.target.value)} placeholder="Ej: Piloto Privado, Piloto Comercial..." />
            <button className="btn">Crear curso</button>
          </form>

          <div className="card">
            <table>
              <thead>
                <tr><th>Curso</th><th>Alumnos</th><th></th></tr>
              </thead>
              <tbody>
                {cursos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c._count?.students ?? 0}</td>
                    <td>
                      <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarCurso(c.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {cursos.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>Todavía no has creado ningún curso.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal abierto={!!seleccionado} onCerrar={cerrarFicha} ancho={640}>
        {seleccionado && edit && (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{seleccionado.code} — {seleccionado.firstName} {seleccionado.lastName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ingresó el {new Date(seleccionado.enrollmentDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</div>
              </div>
              <button onClick={cerrarFicha} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTabFicha(t.value)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 13,
                    fontWeight: tabFicha === t.value ? 700 : 400,
                    borderBottom: tabFicha === t.value ? '2px solid var(--primary)' : '2px solid transparent',
                    color: tabFicha === t.value ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

              {tabFicha === 'general' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div className="field"><label>Nombre(s)</label><input value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} disabled={!puedeGestionar} /></div>
                  <div className="field"><label>Apellido</label><input value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} disabled={!puedeGestionar} /></div>
                  <div className="field"><label>Correo</label><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} disabled={!puedeGestionar} /></div>
                  <div className="field"><label>Teléfono</label><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} disabled={!puedeGestionar} /></div>
                  <div className="field"><label>Fecha de ingreso</label><input type="date" value={edit.enrollmentDate} onChange={(e) => setEdit({ ...edit, enrollmentDate: e.target.value })} disabled={!puedeGestionar} /></div>
                  <div className="field">
                    <label>Curso principal</label>
                    <select value={edit.courseId} onChange={(e) => setEdit({ ...edit, courseId: e.target.value })} disabled={!puedeGestionar}>
                      <option value="">Sin curso</option>
                      {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Notas</label><textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} disabled={!puedeGestionar} /></div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    {(puedeGestionar || puedeEditarHoras) && (
                      <button className="btn" disabled={guardando} onClick={guardarFicha}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
                    )}
                    {puedeGestionar && (
                      <button className="btn danger" onClick={() => eliminarAlumno(seleccionado.id)}>Eliminar alumno</button>
                    )}
                  </div>
                </div>
              )}

              {tabFicha === 'cursos' && (
                <div>
                  {puedeGestionar && (
                    <form onSubmit={inscribirEnCurso} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <select value={nuevaInscripcionCurso} onChange={(e) => setNuevaInscripcionCurso(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Selecciona un curso para inscribir...</option>
                        {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }}>Inscribir</button>
                    </form>
                  )}

                  {cargandoInscripciones && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando...</div>}
                  {!cargandoInscripciones && inscripciones.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Este alumno no tiene cursos registrados en su historial todavía.</div>
                  )}
                  {!cargandoInscripciones && inscripciones.map((insc) => (
                    <div key={insc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{insc.course.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Inscrito el {new Date(insc.enrolledAt).toLocaleDateString('es-PE')}
                          {insc.completedAt && ` · Completado el ${new Date(insc.completedAt).toLocaleDateString('es-PE')}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                          background: insc.status === 'COMPLETADO' ? '#e6f4ea' : '#fff4e0',
                          color: insc.status === 'COMPLETADO' ? 'var(--success)' : '#a6650a',
                        }}>
                          {insc.status === 'COMPLETADO' ? 'Completado' : 'En curso'}
                        </span>
                        {puedeGestionar && (
                          <>
                            <button className="btn secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => alternarEstadoInscripcion(insc)}>
                              {insc.status === 'COMPLETADO' ? 'Marcar en curso' : 'Marcar completado'}
                            </button>
                            <button className="btn danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => eliminarInscripcion(insc.id)}>Quitar</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tabFicha === 'horas' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={verReporteHoras}>
                      Reporte de horas (PDF)
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className="field"><label>Horas de curso en tierra</label><input type="number" step="0.5" value={edit.groundCourseHours} onChange={(e) => setEdit({ ...edit, groundCourseHours: e.target.value })} disabled={!puedeEditarHoras} /></div>
                    <div className="field"><label>Horas de vuelo</label><input type="number" step="0.5" value={edit.flightHours} onChange={(e) => setEdit({ ...edit, flightHours: e.target.value })} disabled={!puedeEditarHoras} /></div>
                    <div className="field"><label>Horas de simulador</label><input type="number" step="0.5" value={edit.simulatorHours} onChange={(e) => setEdit({ ...edit, simulatorHours: e.target.value })} disabled={!puedeEditarHoras} /></div>
                  </div>
                  {puedeEditarHoras && (
                    <button className="btn" style={{ marginTop: 12 }} disabled={guardando} onClick={guardarFicha}>{guardando ? 'Guardando...' : 'Guardar horas'}</button>
                  )}
                </div>
              )}

              {tabFicha === 'programar' && (
                <div>
                  {puedeGestionarProgramaciones && (
                    <form onSubmit={programarSesion} className="card" style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Programar sesión nueva</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="field">
                          <label>Tipo</label>
                          <select value={nuevaSesion.type} onChange={(e) => setNuevaSesion({ ...nuevaSesion, type: e.target.value })}>
                            {TIPOS_SESION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Instructor</label>
                          <select value={nuevaSesion.instructorId} onChange={(e) => setNuevaSesion({ ...nuevaSesion, instructorId: e.target.value })}>
                            <option value="">Selecciona un instructor</option>
                            {instructores.map((i) => <option key={i.id} value={i.id}>{i.firstName} {i.lastName}</option>)}
                          </select>
                        </div>
                        <div className="field"><label>Fecha</label><input type="date" value={nuevaSesion.fecha} onChange={(e) => setNuevaSesion({ ...nuevaSesion, fecha: e.target.value })} /></div>
                        <div className="field"><label>Desde</label><input type="time" value={nuevaSesion.startTime} onChange={(e) => setNuevaSesion({ ...nuevaSesion, startTime: e.target.value })} /></div>
                        <div className="field"><label>Hasta</label><input type="time" value={nuevaSesion.endTime} onChange={(e) => setNuevaSesion({ ...nuevaSesion, endTime: e.target.value })} /></div>
                        <div className="field"><label>Notas (opcional)</label><input value={nuevaSesion.notes} onChange={(e) => setNuevaSesion({ ...nuevaSesion, notes: e.target.value })} /></div>
                      </div>
                      <button className="btn" style={{ marginTop: 10 }} disabled={guardandoSesion}>
                        {guardandoSesion ? 'Programando...' : 'Programar sesión'}
                      </button>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                        Esta sesión aparecerá automáticamente en el calendario de Programaciones.
                      </div>
                    </form>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sesiones programadas</div>
                  {cargandoSesiones && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando...</div>}
                  {!cargandoSesiones && sesionesAlumno.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Este alumno no tiene sesiones programadas.</div>
                  )}
                  {!cargandoSesiones && sesionesAlumno.map((s) => (
                    <div key={s.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_TIPO_SESION[s.type], display: 'inline-block' }} />
                        <strong style={{ fontSize: 13 }}>{LABEL_TIPO_SESION[s.type]}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(s.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, {s.startTime}–{s.endTime}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>Instructor: {s.instructor.firstName} {s.instructor.lastName}</div>
                      {puedeGestionarProgramaciones && (
                        <button className="btn danger" style={{ padding: '2px 8px', fontSize: 10, marginTop: 4 }} onClick={() => eliminarSesionAlumno(s.id)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tabFicha === 'pagos' && (
                puedeVerPagos ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                      <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={verEstadoDeCuenta}>
                        Estado de cuenta (PDF)
                      </button>
                    </div>

                    {cargandoCuotas && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando...</div>}
                    {!cargandoCuotas && cuotas.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Sin cuotas registradas.</div>
                    )}
                    {!cargandoCuotas && cuotas.map((c) => {
                      const vencida = !c.paidDate && new Date(c.dueDate) < new Date();
                      return (
                        <div key={c.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <strong>{c.concept}</strong>
                            <span>{SIMBOLO_MONEDA[c.currency] || 'S/'} {Number(c.amount).toFixed(2)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Vence: {new Date(c.dueDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}
                            {' · '}
                            {c.paidDate ? `Pagada el ${new Date(c.paidDate).toLocaleDateString('es-PE')}` : vencida ? 'Vencida' : 'Pendiente'}
                          </div>
                          {c.paidDate && c.paidBy && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Autorizado por: {c.paidBy.firstName} {c.paidBy.lastName}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button className="btn secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => alternarPagada(c)}>
                              {c.paidDate ? 'Marcar pendiente' : 'Marcar pagada'}
                            </button>
                            <button className="btn secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => verBoletaPago(c)}>
                              Boleta (PDF)
                            </button>
                            <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarCuota(c.id)}>Eliminar</button>
                          </div>
                        </div>
                      );
                    })}

                    {mostrarNuevaCuota ? (
                      <form onSubmit={crearCuota} style={{ marginTop: 8 }}>
                        <div className="field"><label>Concepto</label><input value={nuevaCuota.concept} onChange={(e) => setNuevaCuota({ ...nuevaCuota, concept: e.target.value })} placeholder="Ej: Cuota 1" required /></div>
                        <div className="field">
                          <label>Moneda</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className={`btn ${nuevaCuota.currency === 'PEN' ? '' : 'secondary'}`}
                              style={{ padding: '5px 14px', fontSize: 12 }}
                              onClick={() => setNuevaCuota({ ...nuevaCuota, currency: 'PEN' })}
                            >
                              Soles (S/)
                            </button>
                            <button
                              type="button"
                              className={`btn ${nuevaCuota.currency === 'USD' ? '' : 'secondary'}`}
                              style={{ padding: '5px 14px', fontSize: 12 }}
                              onClick={() => setNuevaCuota({ ...nuevaCuota, currency: 'USD' })}
                            >
                              Dólares ($)
                            </button>
                          </div>
                        </div>
                        <div className="field"><label>Monto ({SIMBOLO_MONEDA[nuevaCuota.currency]})</label><input type="number" step="0.01" value={nuevaCuota.amount} onChange={(e) => setNuevaCuota({ ...nuevaCuota, amount: e.target.value })} required /></div>
                        <div className="field"><label>Fecha de vencimiento</label><input type="date" value={nuevaCuota.dueDate} onChange={(e) => setNuevaCuota({ ...nuevaCuota, dueDate: e.target.value })} required /></div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }}>Guardar cuota</button>
                          <button type="button" className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setMostrarNuevaCuota(false)}>Cancelar</button>
                        </div>
                      </form>
                    ) : (
                      <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setMostrarNuevaCuota(true)}>+ Nueva cuota</button>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tienes permiso para ver la información de pagos de este alumno.</div>
                )
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
