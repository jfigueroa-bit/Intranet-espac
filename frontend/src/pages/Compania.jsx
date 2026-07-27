import { useEffect, useState } from 'react';
import api from '../api/client';
import AreaChip from '../components/AreaChip.jsx';
import OrgChart from '../components/OrgChart.jsx';
import { colorTextoLegible } from '../utils/color';

const ESTADO_LABEL = { PRESENCIAL: '🏢 Presencial', HOME_OFFICE: '🏠 Home Office', VACACIONES: '🌴 Vacaciones' };

export default function Compania() {
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [filtroIds, setFiltroIds] = useState([]);
  const [vista, setVista] = useState('lista');

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/areas')]).then(([u, a]) => {
      setUsuarios(u.data);
      setAreas(a.data);
    });
  }, []);

  function toggleFiltro(areaId) {
    setFiltroIds((f) => (f.includes(areaId) ? f.filter((id) => id !== areaId) : [...f, areaId]));
  }

  const usuariosFiltrados =
    filtroIds.length === 0
      ? usuarios
      : usuarios.filter((u) => u.areas?.some((a) => filtroIds.includes(a.area.id)));

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🏢 Compañía</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Directorio de todo el personal de ESPAC, ordenado según la jerarquía definida por Admin.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setVista('lista')}
          className={`btn ${vista === 'lista' ? '' : 'secondary'}`}
          style={{ padding: '6px 16px', fontSize: 13 }}
        >
          📋 Lista
        </button>
        <button
          onClick={() => setVista('organigrama')}
          className={`btn ${vista === 'organigrama' ? '' : 'secondary'}`}
          style={{ padding: '6px 16px', fontSize: 13 }}
        >
          🌳 Organigrama
        </button>
      </div>

      {vista === 'lista' && areas.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏷️ Filtrar por área
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              onClick={() => setFiltroIds([])}
              style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)',
                background: filtroIds.length === 0 ? 'var(--primary)' : '#fff',
                color: filtroIds.length === 0 ? '#fff' : 'var(--text)',
              }}
            >
              Todos
            </button>
            {areas.map((a) => {
              const activo = filtroIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleFiltro(a.id)}
                  style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: 'none',
                    background: activo ? a.color : '#eee',
                    color: activo ? colorTextoLegible(a.color) : 'var(--text-muted)',
                    opacity: activo ? 1 : 0.85,
                  }}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {vista === 'lista' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {usuariosFiltrados.map((u) => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {u.profilePhoto ? (
                  <img src={u.profilePhoto} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{u.firstName} {u.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.cargo || 'Sin cargo'} · {u.email}</div>
                  {u.areas?.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {u.areas.map((a) => <AreaChip key={a.area.id} area={a.area} />)}
                    </div>
                  )}
                </div>
              </div>
              <span className={`badge ${u.workStatus.toLowerCase()}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {ESTADO_LABEL[u.workStatus]}
              </span>
            </div>
          ))}
          {usuariosFiltrados.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              🔍 Nadie coincide con ese filtro.
            </div>
          )}
        </div>
      )}

      {vista === 'organigrama' && (
        <div className="card">
          <OrgChart usuarios={usuarios} />
        </div>
      )}
    </div>
  );
}
