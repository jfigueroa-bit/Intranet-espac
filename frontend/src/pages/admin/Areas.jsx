import { useEffect, useState } from 'react';
import api from '../../api/client';
import AreaChip from '../../components/AreaChip.jsx';

const COLORES_SUGERIDOS = [
  '#1c2b4a', '#2e7d32', '#c9a227', '#b3261e', '#2952cc',
  '#7b3fa0', '#0f766e', '#c2410c', '#4b5563', '#be185d',
];

export default function Areas() {
  const [areas, setAreas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORES_SUGERIDOS[0]);
  const [error, setError] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [edit, setEdit] = useState({ name: '', color: '' });

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await api.get('/areas');
    setAreas(data);
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/areas', { name: nombre, color });
      setNombre('');
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el área');
    }
  }

  function empezarEdicion(area) {
    setEditandoId(area.id);
    setEdit({ name: area.name, color: area.color });
  }

  async function guardarEdicion(id) {
    await api.patch(`/areas/${id}`, edit);
    setEditandoId(null);
    cargar();
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta área? Se quitará de todos los usuarios que la tengan.')) return;
    await api.delete(`/areas/${id}`);
    cargar();
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Áreas / Tags</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Cada área tiene un color, así se distinguen fácil en Usuarios y Compañía.
        Se usan también para los permisos de Documentos y los canales del Chat interno.
      </p>

      <form onSubmit={crear} className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Nombre del área</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Vuelos, Simuladores, Ventas..." required />
        </div>
        <div className="field">
          <label>Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {COLORES_SUGERIDOS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 26, height: 26, borderRadius: '50%', background: c,
                  border: color === c ? '3px solid var(--primary)' : '1px solid var(--border)',
                  padding: 0,
                }}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, padding: 2 }} />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn" style={{ marginTop: 10 }}>Crear área</button>
      </form>

      <div className="card">
        {areas.map((a) => (
          <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {editandoId === a.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  style={{ maxWidth: 180 }}
                />
                <input
                  type="color"
                  value={edit.color}
                  onChange={(e) => setEdit({ ...edit, color: e.target.value })}
                  style={{ width: 40, padding: 2 }}
                />
                <button className="btn" style={{ padding: '6px 12px' }} onClick={() => guardarEdicion(a.id)}>Guardar</button>
                <button className="btn secondary" style={{ padding: '6px 12px' }} onClick={() => setEditandoId(null)}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <AreaChip area={a} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => empezarEdicion(a)}>Editar</button>
                  <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(a.id)}>Eliminar</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {areas.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Todavía no has creado ningún área.</div>}
      </div>
    </div>
  );
}
