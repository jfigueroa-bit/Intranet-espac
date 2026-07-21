import { createElement, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useChatUnread } from '../context/ChatUnreadContext.jsx';
import { conectarSocket } from '../socket';
import { conEnlacesClickeables } from '../utils/enlaces.jsx';
import AreaChip from './AreaChip.jsx';

const MAX_ARCHIVO_MB = 10;
const EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🎉', '😢', '😮', '🔥', '❤️', '👏', '🤔'];

function nombreConversacion(c) {
  if (!c) return '';
  if (c.type === 'AREA') return c.area?.name || 'Área';
  return c.otherUser ? `${c.otherUser.firstName} ${c.otherUser.lastName}` : 'Chat';
}

function esImagen(mime) {
  return mime?.startsWith('image/');
}

// Enlace de descarga armado con createElement (no JSX) para que no se rompa al copiar/pegar.
function enlaceArchivo(mensaje, esMio) {
  const estilo = { display: 'block', textDecoration: 'underline', fontSize: 12 };
  estilo.marginTop = mensaje.content ? 6 : 0;
  estilo.color = esMio ? '#fff' : 'var(--primary)';
  return createElement('a', { href: mensaje.fileData, download: mensaje.fileName, style: estilo }, '📎 ' + mensaje.fileName);
}

export default function ChatDock() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount, conversaciones, refrescarNoLeidos } = useChatUnread();
  const [abierto, setAbierto] = useState(false);
  const [conversacionId, setConversacionId] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const finRef = useRef(null);

  const conversacionActiva = conversaciones.find((c) => c.id === conversacionId) || null;

  useEffect(() => {
    const socket = conectarSocket();
    if (!socket) return;
    function alRecibir(payload) {
      setConversacionId((idActual) => {
        if (idActual === payload.conversationId) {
          setMensajes((prev) => (prev.some((m) => m.id === payload.mensaje.id) ? prev : [...prev, payload.mensaje]));
          api.patch(`/chats/${payload.conversationId}/leido`).then(() => refrescarNoLeidos());
        }
        return idActual;
      });
    }
    socket.on('chat:mensaje', alRecibir);
    return () => socket.off('chat:mensaje', alRecibir);
  }, [refrescarNoLeidos]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function abrirConversacion(id) {
    setConversacionId(id);
    setError('');
    const { data } = await api.get(`/chats/${id}/mensajes`);
    setMensajes(data);
    await api.patch(`/chats/${id}/leido`);
    refrescarNoLeidos();
  }

  function volverALista() {
    setConversacionId(null);
    setMensajes([]);
    setMostrarEmojis(false);
  }

  function irAPaginaCompleta() {
    setAbierto(false);
    navigate(`/chat?c=${conversacionId}`);
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
    reader.onload = () => {
      setArchivo(reader.result);
      setArchivoNombre(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim() && !archivo) return;
    setEnviando(true);
    setError('');
    try {
      const mimeType = archivo ? archivo.split(';')[0].replace('data:', '') : null;
      const { data } = await api.post(`/chats/${conversacionId}/mensajes`, {
        content: texto,
        fileData: archivo,
        fileName: archivoNombre || null,
        mimeType,
      });
      setMensajes((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setTexto('');
      setArchivo(null);
      setArchivoNombre('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60 }}>
      {abierto && (
        <div style={{
          width: 380, height: 480, background: '#fff', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginBottom: 10, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {!conversacionActiva && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
                Bandeja de entrada
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {conversaciones.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => abrirConversacion(c.id)}
                    style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: c.unread ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.type === 'AREA' && c.area ? <AreaChip area={c.area} /> : nombreConversacion(c)}
                      </div>
                      {c.unread && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />}
                    </div>
                    {c.lastMessage && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.lastMessage.sender.firstName}: {c.lastMessage.content || '📎 Archivo'}
                      </div>
                    )}
                  </div>
                ))}
                {conversaciones.length === 0 && (
                  <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>No tienes conversaciones todavía.</div>
                )}
              </div>
            </>
          )}

          {conversacionActiva && (
            <>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={volverALista} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 0 }}>←</button>
                <div style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conversacionActiva.type === 'AREA' && conversacionActiva.area
                    ? `Chat de ${conversacionActiva.area.name}`
                    : nombreConversacion(conversacionActiva)}
                </div>
                <button onClick={irAPaginaCompleta} title="Abrir en Chat interno" style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}>⤢</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mensajes.map((m) => {
                  const esMio = m.sender.id === user?.id;
                  return (
                    <div key={m.id} style={{ alignSelf: esMio ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      {!esMio && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{m.sender.firstName}</div>
                      )}
                      <div style={{
                        background: esMio ? 'var(--primary)' : '#f0f0f2', color: esMio ? '#fff' : 'var(--text)',
                        borderRadius: 10, padding: '7px 10px', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {conEnlacesClickeables(m.content)}
                        {m.fileData && esImagen(m.mimeType) && (
                          <img src={m.fileData} alt={m.fileName} style={{ maxWidth: '100%', borderRadius: 6, marginTop: m.content ? 6 : 0, display: 'block' }} />
                        )}
                        {m.fileData && !esImagen(m.mimeType) && enlaceArchivo(m, esMio)}
                      </div>
                    </div>
                  );
                })}
                <div ref={finRef} />
              </div>

              {error && <div className="error-text" style={{ padding: '0 12px', fontSize: 12 }}>{error}</div>}

              {archivo && (
                <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📎 {archivoNombre}</span>
                  <button onClick={() => { setArchivo(null); setArchivoNombre(''); }} style={{ background: 'none', border: 'none', color: 'var(--danger)' }}>Quitar</button>
                </div>
              )}

              {mostrarEmojis && (
                <div style={{ padding: '6px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setTexto((t) => t + e)}
                      style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={enviar} style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                <button type="button" onClick={() => setMostrarEmojis((v) => !v)} style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', padding: 0 }}>
                  😊
                </button>
                <label style={{ cursor: 'pointer', fontSize: 17 }}>
                  📎
                  <input type="file" onChange={elegirArchivo} style={{ display: 'none' }} />
                </label>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} disabled={enviando || (!texto.trim() && !archivo)}>
                  Enviar
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 999,
          background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)', fontSize: 14, fontWeight: 600,
        }}
      >
        💬 Chats
        {unreadCount > 0 && (
          <span style={{
            background: 'var(--danger)', borderRadius: 999, fontSize: 11, fontWeight: 700,
            minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          }}>
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
