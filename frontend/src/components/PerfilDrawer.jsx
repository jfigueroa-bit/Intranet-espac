import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AreaChip from './AreaChip.jsx';

const MAX_FOTO_MB = 3;
const ROLE_LABEL = {
  ADMIN: 'Administrador', GERENCIA: 'Gerencia', RRHH: 'Recursos Humanos',
  MARKETING: 'Marketing', VENTAS: 'Ventas', INSTRUCTOR: 'Instructor', EMPLEADO: 'Colaborador',
};
const ESTADO_LABEL = { PRESENCIAL: 'Presencial', HOME_OFFICE: 'Home Office', VACACIONES: 'De vacaciones' };
const campoLabel = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 };

export default function PerfilDrawer({ abierto, onCerrar, onFotoActualizada }) {
  const [perfil, setPerfil] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto]);

  async function cargar() {
    const { data } = await api.get('/auth/me');
    setPerfil(data);
  }

  function elegirFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setError(`La imagen no puede pesar más de ${MAX_FOTO_MB}MB`);
      return;
    }
    setError('');
    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      await api.patch('/auth/foto', { profilePhoto: dataUrl });
      await cargar();
      setSubiendo(false);
      onFotoActualizada?.(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  if (!abierto) return null;

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 70 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, background: '#fff',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.15)', zIndex: 71, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 15 }}>Mi Perfil</strong>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {perfil && (
          <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {perfil.profilePhoto ? (
                  <img src={perfil.profilePhoto} alt="Foto de perfil" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>
                    {perfil.firstName?.[0]}{perfil.lastName?.[0]}
                  </div>
                )}
                <label style={{
                  position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', color: '#fff',
                  borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, cursor: 'pointer', border: '2px solid #fff',
                }}>
                  📷
                  <input type="file" accept="image/*" onChange={elegirFoto} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 10 }}>{perfil.firstName} {perfil.lastName}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{perfil.cargo || ROLE_LABEL[perfil.role]}</div>
            </div>

            {subiendo && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 10 }}>Subiendo foto...</div>}
            {error && <div className="error-text" style={{ textAlign: 'center' }}>{error}</div>}

            <div style={{ display: 'grid', gap: 12, fontSize: 13 }}>
              <div><span style={campoLabel}>Usuario</span><div>{perfil.username}</div></div>
              <div><span style={campoLabel}>Correo</span><div>{perfil.email}</div></div>
              <div><span style={campoLabel}>Rol</span><div>{ROLE_LABEL[perfil.role]}</div></div>
              <div><span style={campoLabel}>Estado</span><div>{ESTADO_LABEL[perfil.workStatus]}</div></div>
              <div><span style={campoLabel}>Vacaciones</span><div>{perfil.vacationDaysTotal - perfil.vacationDaysUsed} de {perfil.vacationDaysTotal} días disponibles</div></div>
              {perfil.areas?.length > 0 && (
                <div>
                  <span style={campoLabel}>Áreas</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {perfil.areas.map((a) => <AreaChip key={a.area.id} area={a.area} />)}
                  </div>
                </div>
              )}
            </div>

            <Link to="/perfil" onClick={onCerrar} className="btn" style={{ display: 'block', textAlign: 'center', marginTop: 22, textDecoration: 'none' }}>
              Ver perfil completo
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
