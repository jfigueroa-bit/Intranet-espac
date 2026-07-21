import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

// Convierte encabezados de Excel en español/inglés, con o sin tildes, a nuestras claves internas
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

export default function Alumnos() {
  const { user } = useAuth();
  const esAdmin = user?.role === 'ADMIN';
  const puedeGestionar = ['ADMIN', 'GERENCIA', 'VENTAS'].includes(user?.role);
  const puedeEditarHoras = puedeGestionar || user?.role === 'INSTRUCTOR';

  const [tab, setTab] = useState('lista');
  const [alumnos, setAlumnos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [edit, setEdit] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ firstName: '', lastName: '', email: '', phone: '', courseId: '', enrollmentDate: new Date().toISOString().slice(0, 10) });

  const [filasImportar, setFilasImportar] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState(null);

  const [nuevoCurso, setNuevoCurso] = useState('');

  useEffect(() => { cargarCursos(); }, []);
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
    setEdit({
      firstName: alumno.firstName, lastName: alumno.lastName,
      email: alumno.email || '', phone: alumno.phone || '',
      courseId: alumno.courseId || '',
      enrollmentDate: alumno.enrollmentDate ? alumno.enrollmentDate.slice(0, 10) : '',
      groundCourseHours: alumno.groundCourseHours, flightHours: alumno.flightHours, simulatorHours: alumno.simulatorHours,
      notes: alumno.notes || '',
    });
    setError('');
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
    if (!confirm('¿Eliminar a este alumno? Esta acción no se puede deshacer.')) return;
    await api.delete(`/students/${id}`);
    setSeleccionado(null);
    cargarAlumnos();
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
        <div style={{ display: 'grid', gridTemplateColumns: seleccionado ? '1fr 340px' : '1fr', gap: 16 }}>
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

          {seleccionado && edit && (
            <div className="card" style={{ alignSelf: 'flex-start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{seleccionado.code}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ingresó el {new Date(seleccionado.enrollmentDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</div>
                </div>
                <button onClick={() => setSeleccionado(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div className="field"><label>Nombre(s)</label><input value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} disabled={!puedeGestionar} /></div>
                <div className="field"><label>Apellido</label><input value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} disabled={!puedeGestionar} /></div>
                <div className="field"><label>Correo</label><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} disabled={!puedeGestionar} /></div>
                <div className="field"><label>Teléfono</label><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} disabled={!puedeGestionar} /></div>
                <div className="field"><label>Fecha de ingreso</label><input type="date" value={edit.enrollmentDate} onChange={(e) => setEdit({ ...edit, enrollmentDate: e.target.value })} disabled={!puedeGestionar} /></div>
                <div className="field">
                  <label>Curso</label>
                  <select value={edit.courseId} onChange={(e) => setEdit({ ...edit, courseId: e.target.value })} disabled={!puedeGestionar}>
                    <option value="">Sin curso</option>
                    {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Horas de curso en tierra</label><input type="number" step="0.5" value={edit.groundCourseHours} onChange={(e) => setEdit({ ...edit, groundCourseHours: e.target.value })} disabled={!puedeEditarHoras} /></div>
                <div className="field"><label>Horas de vuelo</label><input type="number" step="0.5" value={edit.flightHours} onChange={(e) => setEdit({ ...edit, flightHours: e.target.value })} disabled={!puedeEditarHoras} /></div>
                <div className="field"><label>Horas de simulador</label><input type="number" step="0.5" value={edit.simulatorHours} onChange={(e) => setEdit({ ...edit, simulatorHours: e.target.value })} disabled={!puedeEditarHoras} /></div>
                <div className="field"><label>Notas</label><textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} disabled={!puedeGestionar} /></div>
              </div>

              {error && <div className="error-text">{error}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {(puedeGestionar || puedeEditarHoras) && (
                  <button className="btn" disabled={guardando} onClick={guardarFicha}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
                )}
                {puedeGestionar && (
                  <button className="btn danger" onClick={() => eliminarAlumno(seleccionado.id)}>Eliminar</button>
                )}
              </div>
            </div>
          )}
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
    </div>
  );
}
