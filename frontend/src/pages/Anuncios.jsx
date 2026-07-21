import { useEffect, useState } from 'react';
import api from '../api/client';
import AreaChip from '../components/AreaChip.jsx';
import { conectarSocket } from '../socket';
import { useAuth } from '../context/AuthContext';

const MAX_IMAGEN_MB = 10;

export default function Anuncios() {
  const { user } = useAuth();
  const [anuncios, setAnuncios] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [imagen, setImagen] = useState(null); // base64
  const [imagenNombre, setImagenNombre] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState('');
  const [verLikesDe, setVerLikesDe] = useState(null);
  const [comentarioTexto, setComentarioTexto] = useState({}); // { [anuncioId]: texto }

  useEffect(() => {
    cargar();
    const socket = conectarSocket();
    if (socket) {
      socket.on('notificacion:nueva', (noti) => {
        if (noti.type === 'ANUNCIO') cargar();
      });
    }
    return () => socket?.off('notificacion:nueva');
  }, []);

  async function cargar() {
    const { data } = await api.get('/announcements');
    setAnuncios(data);
  }

  function elegirImagen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGEN_MB * 1024 * 1024) {
      setError(`La imagen no puede pesar más de ${MAX_IMAGEN_MB}MB`);
      return;
    }
    setError('');
    setImagenNombre(file.name);
    const reader = new FileReader();
    reader.onload = () => setImagen(reader.result);
    reader.readAsDataURL(file);
  }

  async function publicar(e) {
    e.preventDefault();
    setError('');
    setPublicando(true);
    try {
      await api.post('/announcements', { title: titulo, content: contenido, imageData: imagen });
      setTitulo('');
      setContenido('');
      setImagen(null);
      setImagenNombre('');
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo publicar el anuncio');
    } finally {
      setPublicando(false);
    }
  }

  async function fijar(id) {
    await api.patch(`/announcements/${id}/fijar`);
    cargar();
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este anuncio?')) return;
    await api.delete(`/announcements/${id}`);
    cargar();
  }

  async function darLike(id) {
    await api.post(`/announcements/${id}/like`);
    cargar();
  }

  async function comentar(id) {
    const texto = comentarioTexto[id];
    if (!texto?.trim()) return;
    await api.post(`/announcements/${id}/comments`, { content: texto });
    setComentarioTexto((c) => ({ ...c, [id]: '' }));
    cargar();
  }

  async function eliminarComentario(anuncioId, comentarioId) {
    if (!confirm('¿Eliminar este comentario?')) return;
    await api.delete(`/announcements/${anuncioId}/comments/${comentarioId}`);
    cargar();
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Anuncios</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Cualquier persona puede publicar un anuncio para toda la compañía. Se muestra siempre
        quién lo publicó.
      </p>

      <form onSubmit={publicar} className="card" style={{ marginBottom: 20 }}>
        <div className="field">
          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Nuevo horario de atención" required />
        </div>
        <div className="field">
          <label>Anuncio</label>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={3}
            placeholder="Escribe el anuncio..."
            required
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="field">
          <label>Imagen (opcional, máx. {MAX_IMAGEN_MB}MB)</label>
          <input type="file" accept="image/*" onChange={elegirImagen} />
          {imagenNombre && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{imagenNombre}</div>}
          {imagen && <img src={imagen} alt="Vista previa" style={{ marginTop: 8, maxHeight: 160, borderRadius: 8 }} />}
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn" disabled={publicando}>{publicando ? 'Publicando...' : 'Publicar anuncio'}</button>
      </form>

      {anuncios.map((a) => {
        const yaDioLike = a.likes.some((l) => l.userId === user?.id);
        return (
          <div key={a.id} className="card" style={{ marginBottom: 12, borderColor: a.pinned ? 'var(--accent)' : 'var(--border)' }}>
            <h3 style={{ margin: '0 0 4px 0' }}>{a.pinned && '📌 '}{a.title}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              {a.author.firstName} {a.author.lastName}
              {a.author.cargo && ` · ${a.author.cargo}`}
              {' · '}
              {new Date(a.createdAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div>{a.author.areas?.map((ar) => <AreaChip key={ar.area.id} area={ar.area} />)}</div>

            <p style={{ marginTop: 12, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{a.content}</p>
            {a.imageData && <img src={a.imageData} alt={a.title} style={{ width: '100%', borderRadius: 8, marginBottom: 10 }} />}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <button
                onClick={() => darLike(a.id)}
                className={`btn ${yaDioLike ? '' : 'secondary'}`}
                style={{ padding: '4px 12px', fontSize: 13 }}
              >
                {yaDioLike ? '❤️' : '🤍'} Me gusta
              </button>
              {a.likes.length > 0 && (
                <button
                  onClick={() => setVerLikesDe(verLikesDe === a.id ? null : a.id)}
                  style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'underline' }}
                >
                  {a.likes.length} {a.likes.length === 1 ? 'persona' : 'personas'}
                </button>
              )}
              {user?.role === 'ADMIN' && (
                <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={() => fijar(a.id)}>
                  {a.pinned ? 'Desfijar' : 'Fijar arriba'}
                </button>
              )}
              {(user?.id === a.authorId || user?.role === 'ADMIN') && (
                <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(a.id)}>
                  Eliminar
                </button>
              )}
            </div>

            {verLikesDe === a.id && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Les gustó a: {a.likes.map((l) => `${l.user.firstName} ${l.user.lastName}`).join(', ')}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
              {a.comments.map((c) => (
                <div key={c.id} style={{ marginBottom: 8, fontSize: 13 }}>
                  <strong>{c.author.firstName} {c.author.lastName}</strong>
                  {c.author.cargo && <span style={{ color: 'var(--text-muted)' }}> · {c.author.cargo}</span>}
                  <div>{c.content}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(c.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {(user?.id === c.authorId || user?.role === 'ADMIN') && (
                      <button
                        onClick={() => eliminarComentario(a.id, c.id)}
                        style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--danger)' }}
                      >
                        {user?.role === 'ADMIN' && user?.id !== c.authorId ? 'Moderar / Eliminar' : 'Eliminar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input
                  placeholder="Escribe un comentario..."
                  value={comentarioTexto[a.id] || ''}
                  onChange={(e) => setComentarioTexto((c) => ({ ...c, [a.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && comentar(a.id)}
                />
                <button className="btn secondary" style={{ padding: '6px 14px' }} onClick={() => comentar(a.id)}>
                  Comentar
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {anuncios.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Todavía no hay anuncios publicados.</div>
      )}
    </div>
  );
}
