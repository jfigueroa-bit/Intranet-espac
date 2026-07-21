import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatUnread } from '../context/ChatUnreadContext.jsx';
import AreaChip from './AreaChip.jsx';

function nombreConversacion(c) {
  if (c.type === 'AREA') return c.area?.name || 'Área';
  return c.otherUser ? `${c.otherUser.firstName} ${c.otherUser.lastName}` : 'Chat';
}

export default function ChatDock() {
  const navigate = useNavigate();
  const { unreadCount, conversaciones } = useChatUnread();
  const [abierto, setAbierto] = useState(false);

  function abrirConversacion(id) {
    setAbierto(false);
    navigate(`/chat?c=${id}`);
  }

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60 }}>
      {abierto && (
        <div style={{
          width: 380, maxHeight: 480, background: '#fff', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginBottom: 10, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
            Bandeja de entrada
          </div>
          <div style={{ overflowY: 'auto' }}>
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
