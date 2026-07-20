import { useEffect, useState } from 'react';
import api from '../api/client';
import AreaChip from '../components/AreaChip.jsx';
import FirmaCanvas from '../components/FirmaCanvas.jsx';
import { DIAS } from '../utils/dias';

const ROLE_LABEL = {
  ADMIN: 'Administrador', GERENCIA: 'Gerencia', RRHH: 'Recursos Humanos',
  MARKETING: 'Marketing', VENTAS: 'Ventas', INSTRUCTOR: 'Instructor', EMPLEADO: 'Colaborador',
};

const MAX_FIRMA_MB = 1;

export default function MiPerfil() {
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [firmaPreview, setFirmaPreview] = useState(null);
  const [guardandoFirma, setGuardandoFirma] = useState(false);
  const [errorFirma, setErrorFirma] = useState('');
  const [modoFirma, setModoFirma] = useState('subir'); // 'subir' | 'dibujar'

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await api.get('/auth/me');
    setPerfil(data);
  }

  async function cambiarEstado(workStatus) {
    setCargando(true);
    try {
      await api.patch(`/users/${perfil.id}/estado`, { workStatus });
      await cargar();
    } finally {
      setCargando(false);
    }
  }

  function elegirFirma(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FIRMA_MB * 1024 * 1024) {
      setErrorFirma(`La imagen no puede pesar más de ${MAX_FIRMA_MB}MB`);
      return;
    }
    setErrorFirma('');
    const reader = new FileReader();
    reader.onload = () => setFirmaPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function guardarFirma(datosFirma) {
    const data = datosFirma || firmaPreview;
    if (!data) return;
    setGuardandoFirma(true);
    try {
      await api.patch('/auth/firma', { signatureData: data });
      setFirmaPreview(null);
      await cargar();
    } finally {
      setGuardandoFirma(false);
    }
  }

  if (!perfil) return null;

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Mi Perfil</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={campoLabel}>Usuario</label><div>{perfil.username}</div></div>
          <div><label style={campoLabel}>Nombre completo</label><div>{perfil.firstName} {perfil.lastName}</div></div>
          <div><label style={campoLabel}>Correo institucional</label><div>{perfil.email}</div></div>
          <div><label style={campoLabel}>Cargo</label><div>{perfil.cargo || '—'}</div></div>
          <div><label style={campoLabel}>Rol en el sistema</label><div>{ROLE_LABEL[perfil.role]}</div></div>
          <div><label style={campoLabel}>Áreas</label><div>{perfil.areas?.map((a) => <AreaChip key={a.area.id} area={a.area} />) || '—'}</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={campoLabel}>Mi estado actual</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className={`btn ${perfil.workStatus === 'PRESENCIAL' ? '' : 'secondary'}`}
            disabled={cargando || perfil.workStatus === 'VACACIONES'}
            onClick={() => cambiarEstado('PRESENCIAL')}
          >
            Presencial
          </button>
          <button
            className={`btn ${perfil.workStatus === 'HOME_OFFICE' ? '' : 'secondary'}`}
            disabled={cargando || perfil.workStatus === 'VACACIONES'}
            onClick={() => cambiarEstado('HOME_OFFICE')}
          >
            Home Office
          </button>
          {perfil.workStatus === 'VACACIONES' && (
            <span className="badge vacaciones" style={{ alignSelf: 'center' }}>De vacaciones</span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>
          El estado "De vacaciones" lo pone el sistema automáticamente cuando tienes
          una solicitud de vacaciones aprobada (módulo de la Fase 5).
        </p>
      </div>

      <div className="card">
        <label style={campoLabel}>Mi horario</label>
        {perfil.schedule?.some((d) => d.active) ? (
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Día</th>
                <th>Entrada</th>
                <th>Salida</th>
              </tr>
            </thead>
            <tbody>
              {DIAS.map(({ key, label }) => {
                const dia = perfil.schedule.find((d) => d.day === key);
                if (!dia?.active) return null;
                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{dia.start}</td>
                    <td>{dia.end}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 13 }}>
            Todavía no se ha asignado tu horario. Lo puede asignar Administración o Recursos Humanos.
          </div>
        )}
        {perfil.scheduleNote && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>{perfil.scheduleNote}</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <label style={campoLabel}>Mi firma digital</label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Guárdala una sola vez, subiendo una foto o dibujándola aquí mismo. Queda lista para
          usarse automáticamente cuando alguien te mande un documento a firmar.
        </p>

        {perfil.signatureData && !firmaPreview && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Firma guardada actualmente:</div>
            <img src={perfil.signatureData} alt="Mi firma" style={{ maxHeight: 80, background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn ${modoFirma === 'subir' ? '' : 'secondary'}`} style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => setModoFirma('subir')}>
            Subir imagen
          </button>
          <button type="button" className={`btn ${modoFirma === 'dibujar' ? '' : 'secondary'}`} style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => setModoFirma('dibujar')}>
            Dibujar firma
          </button>
        </div>

        {modoFirma === 'subir' && (
          <>
            <input type="file" accept="image/*" onChange={elegirFirma} />
            {firmaPreview && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Vista previa:</div>
                <img src={firmaPreview} alt="Vista previa de firma" style={{ maxHeight: 80, background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }} />
                <div>
                  <button className="btn" style={{ marginTop: 10 }} onClick={() => guardarFirma()} disabled={guardandoFirma}>
                    {guardandoFirma ? 'Guardando...' : 'Guardar firma'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {modoFirma === 'dibujar' && (
          <FirmaCanvas onGuardar={(dataUrl) => guardarFirma(dataUrl)} textoBoton={guardandoFirma ? 'Guardando...' : 'Guardar firma'} />
        )}

        {errorFirma && <div className="error-text">{errorFirma}</div>}
      </div>
    </div>
  );
}

const campoLabel = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 };
