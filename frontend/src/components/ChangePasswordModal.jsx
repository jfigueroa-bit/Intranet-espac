import { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordModal({ obligatorio = false, onClose }) {
  const { setMustChangePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setCargando(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setMustChangePassword(false);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3 style={{ marginTop: 0 }}>
          {obligatorio ? 'Crea tu nueva contraseña' : 'Cambiar contraseña'}
        </h3>
        {obligatorio && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Es tu primer ingreso. Antes de continuar, crea una contraseña personal.
          </p>
        )}
        <form onSubmit={guardar}>
          {!obligatorio && (
            <div className="field">
              <label>Contraseña actual</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label>Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="field">
            <label>Confirmar nueva contraseña</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="btn" type="submit" disabled={cargando}>
              {cargando ? 'Guardando...' : 'Guardar'}
            </button>
            {!obligatorio && (
              <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
