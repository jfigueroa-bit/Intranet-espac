import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  { value: 'general', label: 'General', icono: '👤' },
  { value: 'cursos', label: 'Cursos', icono: '🎓' },
  { value: 'horas', label: 'Horas', icono: '⏱️' },
  { value: 'programar', label: 'Programar', icono: '🗓️' },
  { value: 'pagos', label: 'Pagos', icono: '💳' },
];

const SIMBOLO_MONEDA = { PEN: 'S/', USD: '$' };
const ICONO_TIPO = { TEORIA: '📖', SIMULADOR: '🎮', VUELO: '🛩️' };

function TarjetaStat({ icono, color, numero, etiqueta }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '18px 10px' }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: `${color}1a`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px',
      }}>
        {icono}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{numero}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 2 }}>{etiqueta}</div>
    </div>
  );
}

export default function Alumnos() {
  const { user } = useAuth();
  const esAdmin = user?.role === 'ADMIN';
  const puedeGestionar = ['ADMIN', 'GERENCIA', 'VENTAS'].includes(user?.role);
  const puedeEditarHoras = puedeGestionar || user?.role === 'INSTRUCTOR';
  const puedeGestionarProgramaciones = ['ADMIN', 'GERENCIA', 'INSTRUCTOR'].includes(user?.role);

  const [tab, setTab] = useState('lista');
  const [searchParams, setSearchParams] = useSearchParams();
  const [alumnos, setAlumnos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [edit, setEdit] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [tabFicha, setTabFicha] = useState('general');
  const [subTabHoras, setSubTabHoras] = useState('resumen');
  const [editarHorasManual, setEditarHorasManual] = useState(false);
  const [catalogoAbierto, setCatalogoAbierto] = useState('cursos');

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

  const [nuevaSesion, setNuevaSesion] = useState({ type: 'TEORIA', instructorId: '', fecha: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '10:00', notes: '', aircraftTypeId: '', simulatorTypeId: '' });
  const [guardandoSesion, setGuardandoSesion] = useState(false);

  const [aircraftTypes, setAircraftTypes] = useState([]);
  const [simulatorTypes, setSimulatorTypes] = useState([]);
  const [nuevoTipoAvion, setNuevoTipoAvion] = useState('');
  const [nuevoTipoSimulador, setNuevoTipoSimulador] = useState('');

  const [flightLogs, setFlightLogs] = useState([]);
  const [cargandoFlightLogs, setCargandoFlightLogs] = useState(false);
  const [mostrarNuevoVuelo, setMostrarNuevoVuelo] = useState(false);
  const [nuevoVuelo, setNuevoVuelo] = useState({ aircraftTypeId: '', hours: '', date: new Date().toISOString().slice(0, 10), notes: '' });

  const [simulatorLogs, setSimulatorLogs] = useState([]);
  const [cargandoSimulatorLogs, setCargandoSimulatorLogs] = useState(false);
  const [mostrarNuevoSimulador, setMostrarNuevoSimulador] = useState(false);
  const [nuevoSimulador, setNuevoSimulador] = useState({ simulatorTypeId: '', hours: '', date: new Date().toISOString().slice(0, 10), notes: '' });

  useEffect(() => {
    cargarCursos();
    cargarAircraftTypes();
    cargarSimulatorTypes();
    api.get('/users').then((res) => setInstructores(res.data.filter((u) => u.role === 'INSTRUCTOR')));
    api.get('/auth/me').then((res) => {
      setPuedeVerPagos(res.data.canViewPayments || ['ADMIN', 'GERENCIA'].includes(res.data.role));
    });
  }, []);
  useEffect(() => { cargarAlumnos(); }, [busqueda]);

  useEffect(() => {
    const desdeBusqueda = searchParams.get('buscar');
    if (desdeBusqueda) {
      setTab('lista');
      setBusqueda(desdeBusqueda);
      setSearchParams({}, { replace: true });
    }
  }, []);

  async function cargarAlumnos() {
    const { data } = await api.get('/students', { params: { q: busqueda || undefined } });
    setAlumnos(data);
  }

  async function cargarCursos() {
    const { data } = await api.get('/courses');
    setCursos(data);
  }

  async function cargarAircraftTypes() {
    const { data } = await api.get('/aircraft-types');
    setAircraftTypes(data);
  }

  async function cargarSimulatorTypes() {
    const { data } = await api.get('/simulator-types');
    setSimulatorTypes(data);
  }

  async function crearTipoAvion(e) {
    e.preventDefault();
    if (!nuevoTipoAvion.trim()) return;
    await api.post('/aircraft-types', { name: nuevoTipoAvion });
    setNuevoTipoAvion('');
    cargarAircraftTypes();
  }

  async function eliminarTipoAvion(id) {
    if (!confirm('¿Eliminar este tipo de avión?')) return;
    await api.delete(`/aircraft-types/${id}`);
    cargarAircraftTypes();
  }

  async function crearTipoSimulador(e) {
    e.preventDefault();
    if (!nuevoTipoSimulador.trim()) return;
    await api.post('/simulator-types', { name: nuevoTipoSimulador });
    setNuevoTipoSimulador('');
    cargarSimulatorTypes();
  }

  async function eliminarTipoSimulador(id) {
    if (!confirm('¿Eliminar este tipo de simulador?')) return;
    await api.delete(`/simulator-types/${id}`);
    cargarSimulatorTypes();
  }

  function abrirFicha(alumno) {
    setSeleccionado(alumno);
    setTabFicha('general');
    setSubTabHoras('resumen');
    setEditarHorasManual(false);
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
    cargarFlightLogs(alumno.id);
    cargarSimulatorLogs(alumno.id);
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

  function calcularHoras(inicio, fin) {
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(minutos, 0) / 60;
  }

  async function programarSesion(e) {
    e.preventDefault();
    setError('');
    if (!nuevaSesion.instructorId) { setError('Elige un instructor'); return; }
    if (nuevaSesion.type === 'VUELO' && !nuevaSesion.aircraftTypeId) { setError('Elige el tipo de avión'); return; }
    if (nuevaSesion.type === 'SIMULADOR' && !nuevaSesion.simulatorTypeId) { setError('Elige el tipo de simulador'); return; }
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

      const horas = calcularHoras(nuevaSesion.startTime, nuevaSesion.endTime);

      if (nuevaSesion.type === 'VUELO') {
        await api.post('/flight-logs', {
          studentId: seleccionado.id,
          aircraftTypeId: nuevaSesion.aircraftTypeId,
          hours: horas,
          date: nuevaSesion.fecha,
          notes: nuevaSesion.notes || 'Registrado desde Programar',
        });
        setEdit((prev) => ({ ...prev, flightHours: Number(prev.flightHours) + horas }));
        cargarFlightLogs(seleccionado.id);
      }

      if (nuevaSesion.type === 'SIMULADOR') {
        await api.post('/simulator-logs', {
          studentId: seleccionado.id,
          simulatorTypeId: nuevaSesion.simulatorTypeId,
          hours: horas,
          date: nuevaSesion.fecha,
          notes: nuevaSesion.notes || 'Registrado desde Programar',
        });
        setEdit((prev) => ({ ...prev, simulatorHours: Number(prev.simulatorHours) + horas }));
        cargarSimulatorLogs(seleccionado.id);
      }

      setNuevaSesion({ type: 'TEORIA', instructorId: '', fecha: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '10:00', notes: '', aircraftTypeId: '', simulatorTypeId: '' });
      cargarSesionesAlumno(seleccionado.id);
      cargarAlumnos();
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

  async function cargarFlightLogs(studentId) {
    setCargandoFlightLogs(true);
    try {
      const { data } = await api.get('/flight-logs', { params: { studentId } });
      setFlightLogs(data);
    } finally {
      setCargandoFlightLogs(false);
    }
  }

  async function registrarVuelo(e) {
    e.preventDefault();
    setError('');
    if (!nuevoVuelo.aircraftTypeId) { setError('Elige el tipo de avión'); return; }
    try {
      await api.post('/flight-logs', { ...nuevoVuelo, studentId: seleccionado.id });
      setEdit((prev) => ({ ...prev, flightHours: Number(prev.flightHours) + Number(nuevoVuelo.hours) }));
      setNuevoVuelo({ aircraftTypeId: '', hours: '', date: new Date().toISOString().slice(0, 10), notes: '' });
      setMostrarNuevoVuelo(false);
      cargarFlightLogs(seleccionado.id);
      cargarAlumnos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar el vuelo');
    }
  }

  async function eliminarVuelo(registro) {
    if (!confirm('¿Eliminar este vuelo del historial? Se restarán esas horas del total.')) return;
    await api.delete(`/flight-logs/${registro.id}`);
    setEdit((prev) => ({ ...prev, flightHours: Number(prev.flightHours) - Number(registro.hours) }));
    cargarFlightLogs(seleccionado.id);
    cargarAlumnos();
  }

  async function cargarSimulatorLogs(studentId) {
    setCargandoSimulatorLogs(true);
    try {
      const { data } = await api.get('/simulator-logs', { params: { studentId } });
      setSimulatorLogs(data);
    } finally {
      setCargandoSimulatorLogs(false);
    }
  }

  async function registrarSimulador(e) {
    e.preventDefault();
    setError('');
    if (!nuevoSimulador.simulatorTypeId) { setError('Elige el tipo de simulador'); return; }
    try {
      await api.post('/simulator-logs', { ...nuevoSimulador, studentId: seleccionado.id });
      setEdit((prev) => ({ ...prev, simulatorHours: Number(prev.simulatorHours) + Number(nuevoSimulador.hours) }));
      setNuevoSimulador({ simulatorTypeId: '', hours: '', date: new Date().toISOString().slice(0, 10), notes: '' });
      setMostrarNuevoSimulador(false);
      cargarSimulatorLogs(seleccionado.id);
      cargarAlumnos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la sesión de simulador');
    }
  }

  async function eliminarSimulador(registro) {
    if (!confirm('¿Eliminar esta sesión del historial? Se restarán esas horas del total.')) return;
    await api.delete(`/simulator-logs/${registro.id}`);
    setEdit((prev) => ({ ...prev, simulatorHours: Number(prev.simulatorHours) - Number(registro.hours) }));
    cargarSimulatorLogs(seleccionado.id);
    cargarAlumnos();
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
    const html = construirReporteHorasHTML({ alumno: seleccionado, sesiones: sesionesAlumno, flightLogs, simulatorLogs });
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
            🗂️ Catálogos
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
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {a.firstName?.[0]}{a.lastName?.[0]}
                        </div>
                        {a.firstName} {a.lastName}
                      </div>
                    </td>
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
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setCatalogoAbierto(catalogoAbierto === 'cursos' ? '' : 'cursos')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🎓</span> Cursos <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>({cursos.length})</span>
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{catalogoAbierto === 'cursos' ? '▲' : '▼'}</span>
            </button>
            {catalogoAbierto === 'cursos' && (
              <div style={{ padding: '0 16px 16px' }}>
                <form onSubmit={crearCurso} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input value={nuevoCurso} onChange={(e) => setNuevoCurso(e.target.value)} placeholder="Ej: Piloto Privado, Piloto Comercial..." />
                  <button className="btn">Crear</button>
                </form>
                {cursos.map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{c.name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{c._count?.students ?? 0} alumno(s)</span>
                    </div>
                    <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarCurso(c.id)}>Eliminar</button>
                  </div>
                ))}
                {cursos.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Todavía no has creado ningún curso.</div>}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setCatalogoAbierto(catalogoAbierto === 'aviones' ? '' : 'aviones')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🛩️</span> Tipos de avión <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>({aircraftTypes.length})</span>
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{catalogoAbierto === 'aviones' ? '▲' : '▼'}</span>
            </button>
            {catalogoAbierto === 'aviones' && (
              <div style={{ padding: '0 16px 16px' }}>
                <form onSubmit={crearTipoAvion} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input value={nuevoTipoAvion} onChange={(e) => setNuevoTipoAvion(e.target.value)} placeholder="Ej: Cessna 172" />
                  <button className="btn">Agregar</button>
                </form>
                {aircraftTypes.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13 }}>✈️ {t.name}</span>
                    <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarTipoAvion(t.id)}>Eliminar</button>
                  </div>
                ))}
                {aircraftTypes.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Todavía no has agregado ningún tipo de avión.</div>}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setCatalogoAbierto(catalogoAbierto === 'simuladores' ? '' : 'simuladores')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>🎮</span> Tipos de simulador <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>({simulatorTypes.length})</span>
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{catalogoAbierto === 'simuladores' ? '▲' : '▼'}</span>
            </button>
            {catalogoAbierto === 'simuladores' && (
              <div style={{ padding: '0 16px 16px' }}>
                <form onSubmit={crearTipoSimulador} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input value={nuevoTipoSimulador} onChange={(e) => setNuevoTipoSimulador(e.target.value)} placeholder="Ej: Redbird FMX" />
                  <button className="btn">Agregar</button>
                </form>
                {simulatorTypes.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13 }}>🕹️ {t.name}</span>
                    <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarTipoSimulador(t.id)}>Eliminar</button>
                  </div>
                ))}
                {simulatorTypes.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Todavía no has agregado ningún tipo de simulador.</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal abierto={!!seleccionado} onCerrar={cerrarFicha} ancho={680}>
        {seleccionado && edit && (
          <>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {seleccionado.firstName?.[0]}{seleccionado.lastName?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{seleccionado.firstName} {seleccionado.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{seleccionado.code} · Ingresó el {new Date(seleccionado.enrollmentDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</div>
                </div>
              </div>
              <button onClick={cerrarFicha} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 2, padding: '10px 14px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTabFicha(t.value)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontWeight: tabFicha === t.value ? 700 : 400,
                    borderBottom: tabFicha === t.value ? '2px solid var(--primary)' : '2px solid transparent',
                    color: tabFicha === t.value ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  <span>{t.icono}</span> {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1, background: '#fafafa' }}>
              {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

              {tabFicha === 'general' && (
                <div className="card" style={{ display: 'grid', gap: 10 }}>
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
                    <form onSubmit={inscribirEnCurso} className="card" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <select value={nuevaInscripcionCurso} onChange={(e) => setNuevaInscripcionCurso(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Selecciona un curso para inscribir...</option>
                        {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }}>+ Inscribir</button>
                    </form>
                  )}

                  {cargandoInscripciones && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando...</div>}
                  {!cargandoInscripciones && inscripciones.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>🎓 Este alumno no tiene cursos registrados en su historial todavía.</div>
                  )}
                  <div style={{ display: 'grid', gap: 8 }}>
                    {inscripciones.map((insc) => (
                      <div key={insc.id} className="card" style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderLeft: `4px solid ${insc.status === 'COMPLETADO' ? 'var(--success)' : '#e0a013'}`,
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>🎓 {insc.course.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Inscrito el {new Date(insc.enrolledAt).toLocaleDateString('es-PE')}
                            {insc.completedAt && ` · Completado el ${new Date(insc.completedAt).toLocaleDateString('es-PE')}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                            background: insc.status === 'COMPLETADO' ? '#e6f4ea' : '#fff4e0',
                            color: insc.status === 'COMPLETADO' ? 'var(--success)' : '#a6650a',
                          }}>
                            {insc.status === 'COMPLETADO' ? '✓ Completado' : '⏳ En curso'}
                          </span>
                          {puedeGestionar && (
                            <>
                              <button className="btn secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => alternarEstadoInscripcion(insc)}>
                                {insc.status === 'COMPLETADO' ? 'En curso' : 'Completar'}
                              </button>
                              <button className="btn danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => eliminarInscripcion(insc.id)}>Quitar</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tabFicha === 'horas' && (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    <button
                      onClick={() => setSubTabHoras('resumen')}
                      className={`btn ${subTabHoras === 'resumen' ? '' : 'secondary'}`}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      📊 Resumen
                    </button>
                    <button
                      onClick={() => setSubTabHoras('vuelo')}
                      className={`btn ${subTabHoras === 'vuelo' ? '' : 'secondary'}`}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      🛩️ Vuelo
                    </button>
                    <button
                      onClick={() => setSubTabHoras('simulador')}
                      className={`btn ${subTabHoras === 'simulador' ? '' : 'secondary'}`}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      🎮 Simulador
                    </button>
                    <div style={{ flex: 1 }} />
                    <button className="btn secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={verReporteHoras}>
                      📄 Reporte PDF
                    </button>
                  </div>

                  {subTabHoras === 'resumen' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <TarjetaStat icono="📖" color={COLOR_TIPO_SESION.TEORIA} numero={Number(edit.groundCourseHours).toFixed(1)} etiqueta="Hrs. tierra" />
                        <TarjetaStat icono="🛩️" color={COLOR_TIPO_SESION.VUELO} numero={Number(edit.flightHours).toFixed(1)} etiqueta="Hrs. vuelo" />
                        <TarjetaStat icono="🎮" color={COLOR_TIPO_SESION.SIMULADOR} numero={Number(edit.simulatorHours).toFixed(1)} etiqueta="Hrs. simulador" />
                      </div>

                      {puedeEditarHoras && (
                        <div className="card">
                          {!editarHorasManual ? (
                            <button className="btn secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setEditarHorasManual(true)}>
                              ✏️ Corregir horas manualmente
                            </button>
                          ) : (
                            <>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                                Usa esto solo para correcciones puntuales. Lo normal es que las horas se sumen solas desde "Vuelo", "Simulador" o "Programar".
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                <div className="field"><label>Horas de curso en tierra</label><input type="number" step="0.5" value={edit.groundCourseHours} onChange={(e) => setEdit({ ...edit, groundCourseHours: e.target.value })} /></div>
                                <div className="field"><label>Horas de vuelo (total)</label><input type="number" step="0.5" value={edit.flightHours} onChange={(e) => setEdit({ ...edit, flightHours: e.target.value })} /></div>
                                <div className="field"><label>Horas de simulador (total)</label><input type="number" step="0.5" value={edit.simulatorHours} onChange={(e) => setEdit({ ...edit, simulatorHours: e.target.value })} /></div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button className="btn" disabled={guardando} onClick={guardarFicha}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                                <button className="btn secondary" onClick={() => setEditarHorasManual(false)}>Cerrar</button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {subTabHoras === 'vuelo' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>🛩️ {Number(edit.flightHours).toFixed(1)} horas totales</div>
                        {puedeEditarHoras && !mostrarNuevoVuelo && (
                          <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setMostrarNuevoVuelo(true)}>+ Registrar vuelo</button>
                        )}
                      </div>

                      {mostrarNuevoVuelo && (
                        <form onSubmit={registrarVuelo} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${COLOR_TIPO_SESION.VUELO}` }}>
                          <div className="field">
                            <label>Tipo de avión</label>
                            <select value={nuevoVuelo.aircraftTypeId} onChange={(e) => setNuevoVuelo({ ...nuevoVuelo, aircraftTypeId: e.target.value })}>
                              <option value="">Selecciona el tipo de avión</option>
                              {aircraftTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div className="field"><label>Horas</label><input type="number" step="0.1" value={nuevoVuelo.hours} onChange={(e) => setNuevoVuelo({ ...nuevoVuelo, hours: e.target.value })} required /></div>
                          <div className="field"><label>Fecha</label><input type="date" value={nuevoVuelo.date} onChange={(e) => setNuevoVuelo({ ...nuevoVuelo, date: e.target.value })} required /></div>
                          <div className="field"><label>Notas (opcional)</label><input value={nuevoVuelo.notes} onChange={(e) => setNuevoVuelo({ ...nuevoVuelo, notes: e.target.value })} /></div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }}>Guardar vuelo</button>
                            <button type="button" className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setMostrarNuevoVuelo(false)}>Cancelar</button>
                          </div>
                        </form>
                      )}

                      {cargandoFlightLogs && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando...</div>}
                      {!cargandoFlightLogs && flightLogs.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>🛩️ Sin vuelos registrados todavía.</div>
                      )}
                      <div style={{ display: 'grid', gap: 8 }}>
                        {flightLogs.map((f) => (
                          <div key={f.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${COLOR_TIPO_SESION.VUELO}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 22 }}>✈️</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{f.aircraftType.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {new Date(f.date).toLocaleDateString('es-PE', { timeZone: 'UTC' })} · {f.createdBy.firstName} {f.createdBy.lastName}
                                  {f.notes && ` · ${f.notes}`}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontWeight: 700, fontSize: 14 }}>{Number(f.hours).toFixed(1)} hrs</span>
                              {puedeEditarHoras && (
                                <button className="btn danger" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => eliminarVuelo(f)}>Eliminar</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {subTabHoras === 'simulador' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>🎮 {Number(edit.simulatorHours).toFixed(1)} horas totales</div>
                        {puedeEditarHoras && !mostrarNuevoSimulador && (
                          <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setMostrarNuevoSimulador(true)}>+ Registrar sesión</button>
                        )}
                      </div>

                      {mostrarNuevoSimulador && (
                        <form onSubmit={registrarSimulador} className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${COLOR_TIPO_SESION.SIMULADOR}` }}>
                          <div className="field">
                            <label>Tipo de simulador</label>
                            <select value={nuevoSimulador.simulatorTypeId} onChange={(e) => setNuevoSimulador({ ...nuevoSimulador, simulatorTypeId: e.target.value })}>
                              <option value="">Selecciona el tipo de simulador</option>
                              {simulatorTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div className="field"><label>Horas</label><input type="number" step="0.1" value={nuevoSimulador.hours} onChange={(e) => setNuevoSimulador({ ...nuevoSimulador, hours: e.target.value })} required /></div>
                          <div className="field"><label>Fecha</label><input type="date" value={nuevoSimulador.date} onChange={(e) => setNuevoSimulador({ ...nuevoSimulador, date: e.target.value })} required /></div>
                          <div className="field"><label>Notas (opcional)</label><input value={nuevoSimulador.notes} onChange={(e) => setNuevoSimulador({ ...nuevoSimulador, notes: e.target.value })} /></div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }}>Guardar sesión</button>
                            <button type="button" className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setMostrarNuevoSimulador(false)}>Cancelar</button>
                          </div>
                        </form>
                      )}

                      {cargandoSimulatorLogs && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando...</div>}
                      {!cargandoSimulatorLogs && simulatorLogs.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>🎮 Sin sesiones de simulador registradas todavía.</div>
                      )}
                      <div style={{ display: 'grid', gap: 8 }}>
                        {simulatorLogs.map((s) => (
                          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${COLOR_TIPO_SESION.SIMULADOR}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 22 }}>🕹️</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.simulatorType.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {new Date(s.date).toLocaleDateString('es-PE', { timeZone: 'UTC' })} · {s.createdBy.firstName} {s.createdBy.lastName}
                                  {s.notes && ` · ${s.notes}`}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontWeight: 700, fontSize: 14 }}>{Number(s.hours).toFixed(1)} hrs</span>
                              {puedeEditarHoras && (
                                <button className="btn danger" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => eliminarSimulador(s)}>Eliminar</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tabFicha === 'programar' && (
                <div>
                  {puedeGestionarProgramaciones && (
                    <form onSubmit={programarSesion} className="card" style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Programar sesión nueva</div>

                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Tipo</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {TIPOS_SESION.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setNuevaSesion({ ...nuevaSesion, type: t.value })}
                              style={{
                                flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                border: nuevaSesion.type === t.value ? `2px solid ${t.color}` : '2px solid var(--border)',
                                background: nuevaSesion.type === t.value ? `${t.color}14` : '#fff',
                                color: nuevaSesion.type === t.value ? t.color : 'var(--text)',
                              }}
                            >
                              <div style={{ fontSize: 18, marginBottom: 2 }}>{ICONO_TIPO[t.value]}</div>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                        {nuevaSesion.type === 'VUELO' && (
                          <div className="field">
                            <label>Tipo de avión</label>
                            <select value={nuevaSesion.aircraftTypeId} onChange={(e) => setNuevaSesion({ ...nuevaSesion, aircraftTypeId: e.target.value })}>
                              <option value="">Selecciona el tipo de avión</option>
                              {aircraftTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                        )}
                        {nuevaSesion.type === 'SIMULADOR' && (
                          <div className="field">
                            <label>Tipo de simulador</label>
                            <select value={nuevaSesion.simulatorTypeId} onChange={(e) => setNuevaSesion({ ...nuevaSesion, simulatorTypeId: e.target.value })}>
                              <option value="">Selecciona el tipo de simulador</option>
                              {simulatorTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="field"><label>Notas (opcional)</label><input value={nuevaSesion.notes} onChange={(e) => setNuevaSesion({ ...nuevaSesion, notes: e.target.value })} /></div>
                      </div>
                      <button className="btn" style={{ marginTop: 10 }} disabled={guardandoSesion}>
                        {guardandoSesion ? 'Programando...' : 'Programar sesión'}
                      </button>
                      {(nuevaSesion.type === 'VUELO' || nuevaSesion.type === 'SIMULADOR') && (
                        <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 6 }}>
                          ✓ Esto también sumará las horas al historial de {nuevaSesion.type === 'VUELO' ? 'Vuelo' : 'Simulador'} automáticamente.
                        </div>
                      )}
                    </form>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Sesiones programadas</div>
                  {cargandoSesiones && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando...</div>}
                  {!cargandoSesiones && sesionesAlumno.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>🗓️ Este alumno no tiene sesiones programadas.</div>
                  )}
                  <div style={{ display: 'grid', gap: 8 }}>
                    {sesionesAlumno.map((s) => (
                      <div key={s.id} className="card" style={{ borderLeft: `4px solid ${COLOR_TIPO_SESION[s.type]}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 16 }}>{ICONO_TIPO[s.type]}</span>
                              <strong style={{ fontSize: 13 }}>{LABEL_TIPO_SESION[s.type]}</strong>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {new Date(s.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, {s.startTime}–{s.endTime}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, marginTop: 2, color: 'var(--text-muted)' }}>Instructor: {s.instructor.firstName} {s.instructor.lastName}</div>
                          </div>
                          {puedeGestionarProgramaciones && (
                            <button className="btn danger" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => eliminarSesionAlumno(s.id)}>
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tabFicha === 'pagos' && (
                puedeVerPagos ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                      <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={verEstadoDeCuenta}>
                        📄 Estado de cuenta (PDF)
                      </button>
                    </div>

                    {cargandoCuotas && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando...</div>}
                    {!cargandoCuotas && cuotas.length === 0 && (
                      <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>💳 Sin cuotas registradas.</div>
                    )}
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                      {cuotas.map((c) => {
                        const vencida = !c.paidDate && new Date(c.dueDate) < new Date();
                        const colorEstado = c.paidDate ? 'var(--success)' : vencida ? 'var(--danger)' : '#e0a013';
                        return (
                          <div key={c.id} className="card" style={{ borderLeft: `4px solid ${colorEstado}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                              <strong>💰 {c.concept}</strong>
                              <span style={{ fontWeight: 700 }}>{SIMBOLO_MONEDA[c.currency] || 'S/'} {Number(c.amount).toFixed(2)}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                              Vence: {new Date(c.dueDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}
                              {' · '}
                              <span style={{ color: colorEstado, fontWeight: 600 }}>
                                {c.paidDate ? `✓ Pagada el ${new Date(c.paidDate).toLocaleDateString('es-PE')}` : vencida ? '⚠ Vencida' : '⏳ Pendiente'}
                              </span>
                            </div>
                            {c.paidDate && c.paidBy && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Autorizado por: {c.paidBy.firstName} {c.paidBy.lastName}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button className="btn secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => alternarPagada(c)}>
                                {c.paidDate ? 'Marcar pendiente' : 'Marcar pagada'}
                              </button>
                              <button className="btn secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => verBoletaPago(c)}>
                                📄 Boleta
                              </button>
                              <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarCuota(c.id)}>Eliminar</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {mostrarNuevaCuota ? (
                      <form onSubmit={crearCuota} className="card">
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
                  <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>🔒 No tienes permiso para ver la información de pagos de este alumno.</div>
                )
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
