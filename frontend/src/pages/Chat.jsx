import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useChatUnread } from '../context/ChatUnreadContext.jsx';
import { conectarSocket } from '../socket';
import AreaChip from '../components/AreaChip.jsx';

const MAX_ARCHIVO_MB = 5;
const EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🎉', '😢', '😮', '🔥', '❤️', '👏', '🤔'];

function estiloImagenChat(tieneTexto) {
  const estilo = { maxWidth: '100%', borderRadius: 8, display: 'block' };
  estilo.marginTop = tieneTexto ? 6 : 0;
  return estilo;
}

function estiloEnlaceArchivo(tieneTexto, esMio) {
  const estilo = { display: 'block', textDecoration: 'underline', fontSize: 13 };
  estilo.marginTop = tieneTexto ? 6 : 0;
  estilo.color = esMio ? '#fff' : 'var(--primary)';
  return estilo;
}

export default function Chat() {
  const { user } = useAuth();
  const { refrescarNoLeidos } = useChatUnread();
  const [conversaciones, setConversaciones] = useState([]);
  const [activaId, setActivaId] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const finMensajesRef = useRef(null);

  useEffect(() => {
    cargarConversaciones();
    api.get('/users').then((res) => setUsuarios(res.data));

    const socket = conectarSocket();
    if (socket) {
      socket.on('chat:mensaje', (payload) => {
        setActivaId((idActual) => {
          if (idActual === payload.conversationId) {
            setMensajes((prev) => [...prev, payload.mensaje]);
            api.patch(`/chats/${payload.conversationId}/leido`).then(() => refrescarNoLeidos());
          }
          return idActual;
        });
        cargarConversaciones();
      });
    }
    return () => socket?.off('chat:mensaje');
  }, []);

  useEffect(() => {
    finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function cargarConversaciones() {
    const { data } = await api.get('/chats');
    setConversaciones(data);
  }

  async function abrirConversacion(id) {
    setActivaId(id);
    setMostrarNuevo(false);
    const { data } = await api.get(`/chats/${id}/mensajes`);
    setMensajes(data);
    await api.patch(`/chats/${id}/leido`);
    setConversaciones((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)));
    refrescarNoLeidos();
  }

  async function iniciarChatDirecto(otroUserId) {
    const { data } = await api.post('/chats/directo', { userId: otroUserId });
    await cargarConversaciones();
    abrirConversacion(data.id);
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
      const { data } = await api.post(`/chats/${activaId}/mensajes`, {
        content: texto,
        fileData: archivo,
        fileName: archivoNombre || null,
        mimeType,
      });
      setMensajes((prev) => [...prev, data]);
      setTexto('');
      setArchivo(null);
      setArchivoNombre('');
      cargarConversaciones();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  }

  function nombreConversacion(c) {
    if (c.type === 'AREA') return c.area?.name || 'Área';
    return c.otherUser ? `${c.otherUser.firstName} ${c.otherUser.lastName}` : 'Chat';
  }

  const activa = conversaciones.find((c) => c.id === activaId);
  const esImagen = (mime) => mime?.startsWith('image/');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: 'calc(100vh - 140px)' }}>
      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <button className="btn" style={{ width: '100%', fontSize: 13 }} onClick={() => setMostrarNuevo((v) => !v)}>
            + Nuevo chat
          </button>
        </div>

        {mostrarNuevo && (
          <div style={{ borderBottom: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
            {usuarios.filter((u) => u.id !== user?.id).map((u) => (
              <div
                key={u.id}
                onClick={() => iniciarChatDirecto(u.id)}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
              >
                {u.firstName} {u.lastName}
              </div>
            ))}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversaciones.map((c) => (
            <div
              key={c.id}
              onClick={() => abrirConversacion(c.id)}
              style={{
                padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: activaId === c.id ? '#f5f7ff' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, overflow: 'hidden' }}>
                  {c.type === 'AREA' && c.area ? <AreaChip area={c.area} /> : nombreConversacion(c)}
                </div>
                {c.unread && (
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                )}
              </div>
              {c.lastMessage && (
                <div style={{ fontSize: 12, color: c.unread ? 'var(--text)' : 'var(--text-muted)', fontWeight: c.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.lastMessage.sender.firstName}: {c.lastMessage.content || '📎 Archivo'}
                </div>
              )}
            </div>
          ))}
          {conversaciones.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              Todavía no tienes conversaciones. Los chats de tus áreas aparecen solos aquí; para hablar con alguien, dale a "+ Nuevo chat".
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activa && (
          <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: 14 }}>
            Selecciona una conversación para empezar.
          </div>
        )}

        {activa && (
          <>
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
              {activa.type === 'AREA' && activa.area ? <>Chat de {activa.area.name}</> : nombreConversacion(activa)}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mensajes.map((m) => {
                const esMio = m.sender.id === user?.id;
                return (
                  <div key={m.id} style={{ alignSelf: esMio ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    {!esMio && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{m.sender.firstName} {m.sender.lastName}</div>
                    )}
                    <div style={{
                      background: esMio ? 'var(--primary)' : '#f0f0f2', color: esMio ? '#fff' : 'var(--text)',
                      borderRadius: 12, padding: '8px 12px', fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {m.content}
                      {m.fileData && esImagen(m.mimeType) && (
                        <img src={m.fileData} alt={m.fileName} style={estiloImagenChat(m.content)} />
                      )}
                      {m.fileData && !esImagen(m.mimeType) && (
                        <a href={m.fileData} download={m.fileName} style={estiloEnlaceArchivo(m.content, esMio)}>
                          📎 {m.fileName}
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textAlign: esMio ? 'right' : 'left' }}>
                      {new Date(m.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              <div ref={finMensajesRef} />
            </div>

            {error && <div className="error-text" style={{ padding: '0 14px' }}>{error}</div>}

            {archivo && (
              <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>📎 {archivoNombre}</span>
                <button onClick={() => { setArchivo(null); setArchivoNombre(''); }} style={{ background: 'none', border: 'none', color: 'var(--danger)' }}>Quitar</button>
              </div>
            )}

            {mostrarEmojis && (
              <div style={{ padding: '6px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setTexto((t) => t + e)}
                    style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={enviar} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
              <button type="button" onClick={() => setMostrarEmojis((v) => !v)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>
                😊
              </button>
              <label style={{ cursor: 'pointer', fontSize: 20 }}>
                📎
                <input type="file" onChange={elegirArchivo} style={{ display: 'none' }} />
              </label>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe un mensaje..."
                style={{ flex: 1 }}
              />
              <button className="btn" disabled={enviando || (!texto.trim() && !archivo)}>
                Enviar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
