import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const MAX_DOC_MB = 5;
const PUEDE_GESTIONAR = ['ADMIN', 'RRHH'];

export default function Documentos() {
  const { user } = useAuth();
  const esAdmin = user?.role === 'ADMIN';
  const puedeGestionar = PUEDE_GESTIONAR.includes(user?.role);

  const [tab, setTab] = useState('general');
  const [tipos, setTipos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [generales, setGenerales] = useState([]);
  const [personales, setPersonales] = useState([]);
  const [usuarioPersonalId, setUsuarioPersonalId] = useState(user?.id);

  const [formGeneral, setFormGeneral] = useState({ title: '', documentTypeId: '', archivo: null, archivoNombre: '' });
  const [formPersonal, setFormPersonal] = useState({ title: '', documentTypeId: '', ownerId: '', archivo: null, archivoNombre: '' });
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargarBase();
  }, []);

  useEffect(() => {
    if (tab === 'personal') cargarPersonales(usuarioPersonalId);
  }, [tab, usuarioPersonalId]);

  async function cargarBase() {
    const [t, a, g] = await Promise.all([
      api.get('/document-types'),
      api.get('/areas'),
      api.get('/documents', { params: { scope: 'GENERAL' } }),
    ]);
    setTipos(t.data);
    setAreas(a.data);
    setGenerales(g.data);
    if (puedeGestionar) {
      const u = await api.get('/users');
      setUsuarios(u.data);
    }
  }

  async function cargarPersonales(userId) {
    const { data } = await api.get('/documents', { params: { scope: 'PERSONAL', userId } });
    setPersonales(data);
  }

  function leerArchivo(e, setForm) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      setError(`El archivo no puede pesar más de ${MAX_DOC_MB}MB`);
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, archivo: reader.result, archivoNombre: file.name }));
    reader.readAsDataURL(file);
  }

  async function subirGeneral(e) {
    e.preventDefault();
    setError('');
    if (!formGeneral.archivo) { setError('Elige un archivo'); return; }
    setSubiendo(true);
    try {
      await api.post('/documents', {
        title: formGeneral.title,
        fileName: formGeneral.archivoNombre,
        mimeType: formGeneral.archivo.split(';')[0].replace('data:', ''),
        fileData: formGeneral.archivo,
        scope: 'GENERAL',
        documentTypeId: formGeneral.documentTypeId || null,
      });
      setFormGeneral({ title: '', documentTypeId: '', archivo: null, archivoNombre: '' });
      cargarBase();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir el documento');
    } finally {
      setSubiendo(false);
    }
  }

  async function subirPersonal(e) {
    e.preventDefault();
    setError('');
    if (!formPersonal.archivo) { setError('Elige un archivo'); return; }
    if (!formPersonal.ownerId) { setError('Elige a quién pertenece este documento'); return; }
    setSubiendo(true);
    try {
      await api.post('/documents', {
        title: formPersonal.title,
        fileName: formPersonal.archivoNombre,
        mimeType: formPersonal.archivo.split(';')[0].replace('data:', ''),
        fileData: formPersonal.archivo,
        scope: 'PERSONAL',
        documentTypeId: formPersonal.documentTypeId || null,
        ownerId: formPersonal.ownerId,
      });
      setFormPersonal({ title: '', documentTypeId: '', ownerId: '', archivo: null, archivoNombre: '' });
      if (Number(formPersonal.ownerId) === Number(usuarioPersonalId)) cargarPersonales(usuarioPersonalId);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir el documento');
    } finally {
      setSubiendo(false);
    }
  }

  async function descargar(doc) {
    const { data } = await api.get(`/documents/${doc.id}/descargar`);
    const a = document.createElement('a');
    a.href = data.fileData;
    a.download = data.fileName;
    a.click();
  }

  async function eliminarDoc(id, esPersonal) {
    if (!confirm('¿Eliminar este documento?')) return;
    await api.delete(`/documents/${id}`);
    if (esPersonal) cargarPersonales(usuarioPersonalId);
    else cargarBase();
  }

  async function crearTipo(e) {
    e.preventDefault();
    if (!nuevoTipo.trim()) return;
    await api.post('/document-types', { name: nuevoTipo });
    setNuevoTipo('');
    cargarBase();
  }

  async function cambiarPermiso(tipo, areaId) {
    const actuales = tipo.permissions.map((p) => p.areaId);
    const nuevos = actuales.includes(areaId) ? actuales.filter((id) => id !== areaId) : [...actuales, areaId];
    await api.patch(`/document-types/${tipo.id}/permisos`, { areaIds: nuevos });
    cargarBase();
  }

  async function eliminarTipo(id) {
    if (!confirm('¿Eliminar este tipo de documento? Los documentos ya subidos con este tipo se quedan sin categoría.')) return;
    await api.delete(`/document-types/${id}`);
    cargarBase();
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ marginTop: 0 }}>Documentos</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${tab === 'general' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('general')}>
          Documentos generales
        </button>
        <button className={`btn ${tab === 'personal' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('personal')}>
          Mis documentos
        </button>
        {esAdmin && (
          <button className={`btn ${tab === 'tipos' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('tipos')}>
            Tipos y permisos
          </button>
        )}
      </div>

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {tab === 'general' && (
        <div>
          {puedeGestionar && (
            <form onSubmit={subirGeneral} className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Subir documento general</h3>
              <div className="field">
                <label>Título</label>
                <input value={formGeneral.title} onChange={(e) => setFormGeneral({ ...formGeneral, title: e.target.value })} required />
              </div>
              <div className="field">
                <label>Tipo de documento (opcional)</label>
                <select value={formGeneral.documentTypeId} onChange={(e) => setFormGeneral({ ...formGeneral, documentTypeId: e.target.value })}>
                  <option value="">Sin tipo</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Archivo (máx. {MAX_DOC_MB}MB)</label>
                <input type="file" onChange={(e) => leerArchivo(e, setFormGeneral)} required />
              </div>
              <button className="btn" disabled={subiendo}>{subiendo ? 'Subiendo...' : 'Subir'}</button>
            </form>
          )}

          <div className="card">
            {generales.map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {d.documentType?.name || 'Sin tipo'} · Subido por {d.uploadedBy.firstName} {d.uploadedBy.lastName} ·{' '}
                    {new Date(d.createdAt).toLocaleDateString('es-PE')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => descargar(d)}>Descargar</button>
                  {(esAdmin || d.uploadedBy.id === user?.id) && (
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminarDoc(d.id, false)}>Eliminar</button>
                  )}
                </div>
              </div>
            ))}
            {generales.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No hay documentos generales todavía.</div>}
          </div>
        </div>
      )}

      {tab === 'personal' && (
        <div>
          {puedeGestionar && (
            <div className="card" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Viendo la carpeta de:</label>
              <select value={usuarioPersonalId} onChange={(e) => setUsuarioPersonalId(Number(e.target.value))} style={{ marginTop: 6 }}>
                <option value={user.id}>Yo ({user.firstName} {user.lastName})</option>
                {usuarios.filter((u) => u.id !== user.id).map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {puedeGestionar && (
            <form onSubmit={subirPersonal} className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Subir documento personal</h3>
              <div className="field">
                <label>¿Para quién es?</label>
                <select value={formPersonal.ownerId} onChange={(e) => setFormPersonal({ ...formPersonal, ownerId: e.target.value })} required>
                  <option value="">Selecciona a la persona</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Título</label>
                <input value={formPersonal.title} onChange={(e) => setFormPersonal({ ...formPersonal, title: e.target.value })} placeholder="Ej: Acta de préstamo de laptop" required />
              </div>
              <div className="field">
                <label>Tipo de documento (opcional)</label>
                <select value={formPersonal.documentTypeId} onChange={(e) => setFormPersonal({ ...formPersonal, documentTypeId: e.target.value })}>
                  <option value="">Sin tipo</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Archivo (máx. {MAX_DOC_MB}MB)</label>
                <input type="file" onChange={(e) => leerArchivo(e, setFormPersonal)} required />
              </div>
              <button className="btn" disabled={subiendo}>{subiendo ? 'Subiendo...' : 'Subir'}</button>
            </form>
          )}

          <div className="card">
            {personales.map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {d.documentType?.name || 'Sin tipo'} · Subido por {d.uploadedBy.firstName} {d.uploadedBy.lastName} ·{' '}
                    {new Date(d.createdAt).toLocaleDateString('es-PE')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => descargar(d)}>Descargar</button>
                  {esAdmin && (
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminarDoc(d.id, true)}>Eliminar</button>
                  )}
                </div>
              </div>
            ))}
            {personales.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No hay documentos personales aquí todavía.</div>}
          </div>
        </div>
      )}

      {tab === 'tipos' && esAdmin && (
        <div>
          <form onSubmit={crearTipo} className="card" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <input value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} placeholder="Ej: Contratos, Manuales, Actas de préstamo..." />
            <button className="btn">Crear tipo</button>
          </form>

          <div className="card">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
              Marca qué áreas pueden ver los documentos <strong>generales</strong> de cada tipo. Si no marcas
              ninguna área, ese tipo queda visible para toda la empresa. (Esto no afecta a los documentos
              personales, esos siempre son privados de cada quien).
            </p>
            {tipos.map((t) => (
              <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 14 }}>{t.name}</strong>
                  <button className="btn danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => eliminarTipo(t.id)}>Eliminar tipo</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {areas.map((a) => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, width: 'auto' }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto' }}
                        checked={t.permissions.some((p) => p.areaId === a.id)}
                        onChange={() => cambiarPermiso(t, a.id)}
                      />
                      {a.name}
                    </label>
                  ))}
                  {areas.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No hay áreas creadas todavía.</span>}
                </div>
              </div>
            ))}
            {tipos.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Todavía no has creado ningún tipo.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
