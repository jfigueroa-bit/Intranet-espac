import { useEffect, useState } from 'react';
import api from '../api/client';
import AreaChip from '../components/AreaChip.jsx';
import OrgChart from '../components/OrgChart.jsx';
import { colorTextoLegible } from '../utils/color';

const ESTADO_LABEL = { PRESENCIAL: 'Presencial', HOME_OFFICE: 'Home Office', VACACIONES: 'Vacaciones' };

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
      <h2 style={{ marginTop: 0 }}>Compañía</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Directorio de todo el personal de ESPAC, ordenado según la jerarquía definida por Admin.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setVista('lista')}
          className={`btn ${vista === 'lista' ? '' : 'secondary'}`}
          style={{ padding: '6px 16px', fontSize: 13 }}
        >
          Lista
        </button>
        <button
          onClick={() => setVista('organigrama')}
          className={`btn ${vista === 'organigrama' ? '' : 'secondary'}`}
          style={{ padding: '6px 16px', fontSize: 13 }}
        >
          Organigrama
        </button>
      </div>

      {vista === 'lista' && areas.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Filtrar por área
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
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cargo</th>
                <th>Correo institucional</th>
                <th>Áreas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => (
                <tr key={u.id}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.cargo || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.areas?.map((a) => <AreaChip key={a.area.id} area={a.area} />) || '—'}</td>
                  <td>
                    <span className={`badge ${u.workStatus.toLowerCase()}`}>
                      {ESTADO_LABEL[u.workStatus]}
                    </span>
                  </td>
                </tr>
              ))}
              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                    Nadie coincide con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
