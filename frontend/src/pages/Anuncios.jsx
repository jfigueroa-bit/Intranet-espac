import { useEffect, useState } from 'react';
import api from '../api/client';
import AreaChip from '../components/AreaChip.jsx';
import { conectarSocket } from '../socket';
import { useAuth } from '../context/AuthContext';

export default function Anuncios() {
  const { user } = useAuth();
  const [anuncios, setAnuncios] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState('');

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

  async function publicar(e) {
    e.preventDefault();
    setError('');
    setPublicando(true);
    try {
      await api.post('/announcements', { title: titulo, content: contenido });
      setTitulo('');
      setContenido('');
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
        {error && <div className="error-text">{error}</div>}
        <button className="btn" disabled={publicando}>{publicando ? 'Publicando...' : 'Publicar anuncio'}</button>
      </form>

      {anuncios.map((a) => (
        <div key={a.id} className="card" style={{ marginBottom: 12, borderColor: a.pinned ? 'var(--accent)' : 'var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0' }}>
                {a.pinned && '📌 '}{a.title}
              </h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                {a.author.firstName} {a.author.lastName}
                {a.author.cargo && ` · ${a.author.cargo}`}
                {' · '}
                {new Date(a.createdAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
              <div>{a.author.areas?.map((ar) => <AreaChip key={ar.area.id} area={ar.area} />)}</div>
            </div>
          </div>
          <p style={{ marginTop: 12, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{a.content}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {user?.role === 'ADMIN' && (
              <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => fijar(a.id)}>
                {a.pinned ? 'Desfijar' : 'Fijar arriba'}
              </button>
            )}
            {(user?.id === a.authorId || user?.role === 'ADMIN') && (
              <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(a.id)}>
                Eliminar
              </button>
            )}
          </div>
        </div>
      ))}

      {anuncios.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Todavía no hay anuncios publicados.</div>
      )}
    </div>
  );
}
