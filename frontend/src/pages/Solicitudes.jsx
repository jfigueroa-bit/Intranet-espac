import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const MAX_ARCHIVO_MB = 5;
const ESTADO_LABEL = { PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', COMPLETADA: 'Completada', RECHAZADA: 'Rechazada' };
const ESTADO_COLOR = { PENDIENTE: '#c9a227', EN_PROCESO: '#2952cc', COMPLETADA: '#2e7d32', RECHAZADA: '#b3261e' };

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

export default function Solicitudes() {
  const { user } = useAuth();
  const [tab, setTab] = useState('meSolicitan');
  const [solicitudes, setSolicitudes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nueva, setNueva] = useState({ title: '', description: '', assigneeId: '', archivo: null, archivoNombre: '' });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const [decidiendoId, setDecidiendoId] = useState(null);
  const [notaDecision, setNotaDecision] = useState('');
  const [estadoElegido, setEstadoElegido] = useState('EN_PROCESO');

  useEffect(() => {
    api.get('/users').then((res) => setUsuarios(res.data));
  }, []);

  useEffect(() => { cargar(); }, [tab]);

  async function cargar() {
    const { data } = await api.get('/requests', { params: { rol: tab } });
    setSolicitudes(data);
  }

  function elegirArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ARCHIVO_MB * 1024 * 1024) {
      setError(`El archivo no puede pesar más de ${MAX_ARCHIVO_MB}MB`);
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setNueva((n) => ({ ...n, archivo: reader.result, archivoNombre: file.name }));
    reader.readAsDataURL(file);
  }

  async function crearSolicitud(e) {
    e.preventDefault();
    setError('');
    setCreando(true);
    try {
      const mimeType = nueva.archivo ? nueva.archivo.split(';')[0].replace('data:', '') : null;
      await api.post('/requests', {
        title: nueva.title,
        description: nueva.description,
        assigneeId: nueva.assigneeId,
        fileData: nueva.archivo,
        fileName: nueva.archivoNombre || null,
        mimeType,
      });
      setNueva({ title: '', description: '', assigneeId: '', archivo: null, archivoNombre: '' });
      setMostrarNueva(false);
      if (tab === 'mias') cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally {
      setCreando(false);
    }
  }

  function empezarDecision(s) {
    setDecidiendoId(s.id);
    setEstadoElegido('EN_PROCESO');
    setNotaDecision('');
  }

  async function guardarDecision(id) {
    setError('');
    try {
      await api.patch(`/requests/${id}/estado`, { status: estadoElegido, responseNote: notaDecision || null });
      setDecidiendoId(null);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el estado');
    }
  }

  async function eliminarSolicitud(id) {
    if (!confirm('¿Eliminar esta solicitud?')) return;
    await api.delete(`/requests/${id}`);
    cargar();
  }

  function descargarAdjunto(s) {
    const a = document.createElement('a');
    a.href = s.fileData;
    a.download = s.fileName;
    a.click();
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ marginTop: 0 }}>Solicitudes</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'meSolicitan' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('meSolicitan')}>
          Me solicitan
        </button>
        <button className={`btn ${tab === 'mias' ? '' : 'secondary'}`} style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setTab('mias')}>
          Mis solicitudes
        </button>
        <button className="btn secondary" style={{ padding: '6px 16px', fontSize: 13, marginLeft: 'auto' }} onClick={() => setMostrarNueva((v) => !v)}>
          + Nueva solicitud
        </button>
      </div>

      {mostrarNueva && (
        <form onSubmit={crearSolicitud} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Nueva solicitud</h3>
          <div className="field">
            <label>¿A quién va dirigida?</label>
            <select value={nueva.assigneeId} onChange={(e) => setNueva({ ...nueva, assigneeId: e.target.value })} required>
              <option value="">Selecciona a la persona</option>
              {usuarios.filter((u) => u.id !== user?.id).map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}{u.cargo ? ` — ${u.cargo}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Asunto</label>
            <input value={nueva.title} onChange={(e) => setNueva({ ...nueva, title: e.target.value })} placeholder="Ej: Necesito el certificado de trabajo" required />
          </div>
          <div className="field">
            <label>Detalle (opcional)</label>
            <textarea rows={3} value={nueva.description} onChange={(e) => setNueva({ ...nueva, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Adjuntar archivo (opcional, máx. {MAX_ARCHIVO_MB}MB)</label>
            <input type="file" onChange={elegirArchivo} />
            {nueva.archivoNombre && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📎 {nueva.archivoNombre}</div>}
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" disabled={creando}>{creando ? 'Enviando...' : 'Enviar solicitud'}</button>
        </form>
      )}

      {!mostrarNueva && error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {solicitudes.map((s) => (
        <div key={s.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {tab === 'meSolicitan'
                  ? <>De {s.requester.firstName} {s.requester.lastName}</>
                  : <>Para {s.assignee.firstName} {s.assignee.lastName}</>
                } · {new Date(s.createdAt).toLocaleDateString('es-PE')}
              </div>
              {s.description && <div style={{ fontSize: 13, marginTop: 6 }}>{s.description}</div>}
              {s.fileData && (
                <button className="btn secondary" style={{ padding: '3px 10px', fontSize: 11, marginTop: 6 }} onClick={() => descargarAdjunto(s)}>
                  📎 {s.fileName}
                </button>
              )}
              {s.responseNote && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Respuesta: {s.responseNote}</div>
              )}
            </div>
            <Badge status={s.status} />
          </div>

          {tab === 'meSolicitan' && !['COMPLETADA', 'RECHAZADA'].includes(s.status) && (
            decidiendoId === s.id ? (
              <div style={{ marginTop: 10 }}>
                <select value={estadoElegido} onChange={(e) => setEstadoElegido(e.target.value)} style={{ marginBottom: 8 }}>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="COMPLETADA">Completada</option>
                  <option value="RECHAZADA">Rechazada</option>
                </select>
                <input
                  value={notaDecision}
                  onChange={(e) => setNotaDecision(e.target.value)}
                  placeholder="Comentario (opcional)"
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => guardarDecision(s.id)}>Guardar</button>
                  <button className="btn secondary" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => setDecidiendoId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="btn" style={{ marginTop: 10, padding: '5px 14px', fontSize: 12 }} onClick={() => empezarDecision(s)}>
                Actualizar estado
              </button>
            )
          )}

          {tab === 'mias' && (
            <div style={{ marginTop: 10 }}>
              <button className="btn danger" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => eliminarSolicitud(s.id)}>Eliminar</button>
            </div>
          )}
        </div>
      ))}
      {solicitudes.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {tab === 'meSolicitan' ? 'Nadie te ha pedido nada por aquí.' : 'Todavía no has hecho ninguna solicitud.'}
        </div>
      )}
    </div>
  );
}
