import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { construirDocumentoHTML, reemplazarTokens, slugify } from '../utils/documentoHTML';

const MAX_DOC_MB = 5;

export default function Documentos() {
  const { user } = useAuth();
  const esAdmin = user?.role === 'ADMIN';
  const esRRHH = user?.role === 'RRHH';

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

  // --- "Crear documento": plantillas guardadas + generación con 2 firmantes ---
  const [plantillas, setPlantillas] = useState([]);
  const [subVistaCrear, setSubVistaCrear] = useState('generar'); // 'generar' | 'nueva'
  const [plantillaId, setPlantillaId] = useState('');
  const [formGenerar, setFormGenerar] = useState({ ownerId: '', firmante2Id: '', fecha: new Date().toISOString().slice(0, 10), documentTypeId: '', valores: {} });
  const [generando, setGenerando] = useState(false);
  const [nuevaPlantilla, setNuevaPlantilla] = useState({ name: '', intro: '', campos: [] });
  const [nuevoCampoLabel, setNuevoCampoLabel] = useState('');
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  const esJefe = usuarios.some((u) => u.managerId === user?.id);
  const puedeGestionar = esAdmin || esRRHH || esJefe;

  // A quién puede ver/subir documentos personales (persona principal del documento):
  // Admin y RRHH a cualquiera, un jefe de área solo a su propia gente.
  const personasDisponibles = esAdmin || esRRHH ? usuarios : usuarios.filter((u) => u.managerId === user?.id);

  useEffect(() => {
    cargarBase();
  }, []);

  useEffect(() => {
    if (tab === 'personal') cargarPersonales(usuarioPersonalId);
  }, [tab, usuarioPersonalId]);

  async function cargarBase() {
    const [t, a, g, u] = await Promise.all([
      api.get('/document-types'),
      api.get('/areas'),
      api.get('/documents', { params: { scope: 'GENERAL' } }),
      api.get('/users'),
    ]);
    setTipos(t.data);
    setAreas(a.data);
    setGenerales(g.data);
    setUsuarios(u.data);
    try {
      const p = await api.get('/document-templates');
      setPlantillas(p.data);
    } catch {
      setPlantillas([]);
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

  async function abrirDocumento(doc) {
    const { data } = await api.get(`/documents/${doc.id}/descargar`);
    if (data.mimeType === 'text/html') {
      const ventana = window.open('', '_blank');
      ventana.document.write(decodeURIComponent(data.fileData.split(',')[1]));
      ventana.document.close();
    } else {
      const a = document.createElement('a');
      a.href = data.fileData;
      a.download = data.fileName;
      a.click();
    }
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

  // --- Nueva plantilla ---
  function agregarCampo() {
    if (!nuevoCampoLabel.trim()) return;
    const key = slugify(nuevoCampoLabel) || `campo_${nuevaPlantilla.campos.length + 1}`;
    setNuevaPlantilla((p) => ({ ...p, campos: [...p.campos, { key, label: nuevoCampoLabel.trim() }] }));
    setNuevoCampoLabel('');
  }

  function quitarCampo(key) {
    setNuevaPlantilla((p) => ({ ...p, campos: p.campos.filter((c) => c.key !== key) }));
  }

  async function guardarPlantilla(e) {
    e.preventDefault();
    setError('');
    if (!nuevaPlantilla.name.trim() || !nuevaPlantilla.intro.trim()) {
      setError('El nombre y el texto de la plantilla son obligatorios');
      return;
    }
    setGuardandoPlantilla(true);
    try {
      const { data } = await api.post('/document-templates', nuevaPlantilla);
      setPlantillas((p) => [...p, data]);
      setNuevaPlantilla({ name: '', intro: '', campos: [] });
      setPlantillaId(data.id);
      setSubVistaCrear('generar');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la plantilla');
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  async function eliminarPlantilla(id) {
    if (!confirm('¿Eliminar esta plantilla? No se borran los documentos ya generados con ella.')) return;
    await api.delete(`/document-templates/${id}`);
    setPlantillas((p) => p.filter((pl) => pl.id !== id));
    if (Number(plantillaId) === id) setPlantillaId('');
  }

  // --- Generar documento a partir de una plantilla ---
  const plantilla = plantillas.find((p) => p.id === Number(plantillaId));

  function actualizarValorCampo(key, value) {
    setFormGenerar((f) => ({ ...f, valores: { ...f.valores, [key]: value } }));
  }

  async function obtenerFirma(userId) {
    try {
      const { data } = await api.get(`/users/${userId}/firma`);
      return data.signatureData;
    } catch {
      return null;
    }
  }

  async function generarDocumento(e) {
    e.preventDefault();
    setError('');
    if (!plantilla) { setError('Elige una plantilla'); return; }
    if (!formGenerar.ownerId) { setError('Elige a quién pertenece este documento'); return; }
    setGenerando(true);
    try {
      const principal = usuarios.find((u) => u.id === Number(formGenerar.ownerId));
      const segundo = formGenerar.firmante2Id ? usuarios.find((u) => u.id === Number(formGenerar.firmante2Id)) : null;

      const [firma1, firma2] = await Promise.all([
        obtenerFirma(principal.id),
        segundo ? obtenerFirma(segundo.id) : Promise.resolve(null),
      ]);

      const fechaTexto = new Date(formGenerar.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

      const introTexto = reemplazarTokens(plantilla.intro, {
        persona: `${principal.firstName} ${principal.lastName}`,
        cargo: principal.cargo || '',
        fecha: fechaTexto,
        firmante2: segundo ? `${segundo.firstName} ${segundo.lastName}` : '',
        firmante2Cargo: segundo?.cargo || '',
      });

      const camposTabla = (plantilla.fields || []).map((c) => ({ label: c.label, value: formGenerar.valores[c.key] || '' }));

      const html = construirDocumentoHTML({
        nombrePlantilla: plantilla.name,
        introTexto,
        camposTabla,
        firmante1: { nombre: `${principal.firstName} ${principal.lastName}`, cargo: principal.cargo, firma: firma1 },
        firmante2: segundo ? { nombre: `${segundo.firstName} ${segundo.lastName}`, cargo: segundo.cargo, firma: firma2 } : null,
      });

      const fileData = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

      await api.post('/documents', {
        title: `${plantilla.name} — ${principal.firstName} ${principal.lastName}`,
        fileName: `${plantilla.name.replace(/\s+/g, '-')}-${principal.firstName}-${formGenerar.fecha}.html`,
        mimeType: 'text/html',
        fileData,
        scope: 'PERSONAL',
        documentTypeId: formGenerar.documentTypeId || null,
        ownerId: formGenerar.ownerId,
      });

      const ventana = window.open('', '_blank');
      ventana.document.write(html);
      ventana.document.close();

      const ownerAnterior = formGenerar.ownerId;
      setFormGenerar({ ownerId: '', firmante2Id: '', fecha: new Date().toISOString().slice(0, 10), documentTypeId: '', valores: {} });
      if (Number(ownerAnterior) === Number(usuarioPersonalId)) cargarPersonales(usuarioPersonalId);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar el documento');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ marginTop: 0 }}>Documentos</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'general' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('general')}>
          Documentos generales
        </button>
        <button className={`btn ${tab === 'personal' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('personal')}>
          Mis documentos
        </button>
        {puedeGestionar && (
          <button className={`btn ${tab === 'crear' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('crear')}>
            Crear documento
          </button>
        )}
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
                  <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => abrirDocumento(d)}>Ver / Descargar</button>
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
                {personasDisponibles.filter((u) => u.id !== user.id).map((u) => (
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
                  {personasDisponibles.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
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
                  <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => abrirDocumento(d)}>Ver / Descargar</button>
                  {(esAdmin || d.uploadedBy.id === user?.id) && (
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminarDoc(d.id, true)}>Eliminar</button>
                  )}
                </div>
              </div>
            ))}
            {personales.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No hay documentos personales aquí todavía.</div>}
          </div>
        </div>
      )}

      {tab === 'crear' && puedeGestionar && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className={`btn ${subVistaCrear === 'generar' ? '' : 'secondary'}`} style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => setSubVistaCrear('generar')}>
              Generar documento
            </button>
            <button className={`btn ${subVistaCrear === 'nueva' ? '' : 'secondary'}`} style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => setSubVistaCrear('nueva')}>
              + Nueva plantilla
            </button>
          </div>

          {subVistaCrear === 'nueva' && (
            <form onSubmit={guardarPlantilla} className="card">
              <h3 style={{ marginTop: 0 }}>Crear una plantilla nueva</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Escribe el texto del documento. Puedes usar estas palabras especiales y se
                reemplazan solas cuando se genere: <code>{'{{persona}}'}</code>, <code>{'{{cargo}}'}</code>,{' '}
                <code>{'{{fecha}}'}</code>, <code>{'{{firmante2}}'}</code>, <code>{'{{firmante2Cargo}}'}</code>.
              </p>
              <div className="field">
                <label>Nombre de la plantilla</label>
                <input value={nuevaPlantilla.name} onChange={(e) => setNuevaPlantilla({ ...nuevaPlantilla, name: e.target.value })} placeholder="Ej: Constancia de trabajo" required />
              </div>
              <div className="field">
                <label>Texto del documento</label>
                <textarea
                  value={nuevaPlantilla.intro}
                  onChange={(e) => setNuevaPlantilla({ ...nuevaPlantilla, intro: e.target.value })}
                  rows={6}
                  placeholder={'Ej: Por medio del presente se hace constancia de la entrega a {{persona}} ({{cargo}}), con fecha {{fecha}}...'}
                  style={{ resize: 'vertical' }}
                  required
                />
              </div>

              <div className="field">
                <label>Campos adicionales (opcional)</label>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0 }}>
                  Ej: para un acta de préstamo podrías agregar "Equipo entregado" y "Condiciones".
                  Estos aparecen como una tabla al final del documento.
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={nuevoCampoLabel} onChange={(e) => setNuevoCampoLabel(e.target.value)} placeholder="Ej: Equipo entregado" />
                  <button type="button" className="btn secondary" onClick={agregarCampo}>+ Agregar campo</button>
                </div>
                {nuevaPlantilla.campos.map((c) => (
                  <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                    <span>{c.label}</span>
                    <button type="button" onClick={() => quitarCampo(c.key)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12 }}>Quitar</button>
                  </div>
                ))}
              </div>

              <button className="btn" disabled={guardandoPlantilla}>{guardandoPlantilla ? 'Guardando...' : 'Guardar plantilla'}</button>
            </form>
          )}

          {subVistaCrear === 'generar' && (
            <>
              {plantillas.length === 0 ? (
                <div className="card" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Todavía no hay ninguna plantilla creada. Ve a "+ Nueva plantilla" para crear la primera
                  (por ejemplo, un acta de préstamo de equipo).
                </div>
              ) : (
                <form onSubmit={generarDocumento} className="card">
                  <h3 style={{ marginTop: 0 }}>Generar documento</h3>

                  <div className="field">
                    <label>Plantilla</label>
                    <select value={plantillaId} onChange={(e) => { setPlantillaId(e.target.value); setFormGenerar((f) => ({ ...f, valores: {} })); }} required>
                      <option value="">Selecciona una plantilla</option>
                      {plantillas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {plantilla && (esAdmin || plantilla.createdById === user?.id) && (
                      <button type="button" onClick={() => eliminarPlantilla(plantilla.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12 }}>
                        Eliminar esta plantilla
                      </button>
                    )}
                  </div>

                  {plantilla && (
                    <>
                      <div className="field">
                        <label>Persona principal (para quién es el documento)</label>
                        <select value={formGenerar.ownerId} onChange={(e) => setFormGenerar({ ...formGenerar, ownerId: e.target.value })} required>
                          <option value="">Selecciona a la persona</option>
                          {personasDisponibles.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                        </select>
                      </div>

                      <div className="field">
                        <label>Segundo firmante (opcional — ej. jefa de RRHH)</label>
                        <select value={formGenerar.firmante2Id} onChange={(e) => setFormGenerar({ ...formGenerar, firmante2Id: e.target.value })}>
                          <option value="">Sin segundo firmante</option>
                          {usuarios.filter((u) => u.id !== Number(formGenerar.ownerId)).map((u) => (
                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}{u.cargo ? ` — ${u.cargo}` : ''}</option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Fecha</label>
                        <input type="date" value={formGenerar.fecha} onChange={(e) => setFormGenerar({ ...formGenerar, fecha: e.target.value })} required />
                      </div>

                      {(plantilla.fields || []).map((c) => (
                        <div className="field" key={c.key}>
                          <label>{c.label}</label>
                          <input value={formGenerar.valores[c.key] || ''} onChange={(e) => actualizarValorCampo(c.key, e.target.value)} />
                        </div>
                      ))}

                      <div className="field">
                        <label>Tipo de documento para clasificarlo (opcional)</label>
                        <select value={formGenerar.documentTypeId} onChange={(e) => setFormGenerar({ ...formGenerar, documentTypeId: e.target.value })}>
                          <option value="">Sin tipo</option>
                          {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>

                      <button className="btn" disabled={generando}>{generando ? 'Generando...' : 'Generar documento'}</button>
                    </>
                  )}
                </form>
              )}
            </>
          )}
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
