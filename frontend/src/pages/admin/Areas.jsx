import { useEffect, useState } from 'react';
import api from '../../api/client';

export default function Areas() {
  const [areas, setAreas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await api.get('/areas');
    setAreas(data);
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/areas', { name: nombre });
      setNombre('');
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el área');
    }
  }

  async function eliminar(id) {
    await api.delete(`/areas/${id}`);
    cargar();
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>Áreas / Tags</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Estas áreas se usan para organizar a los usuarios, y más adelante para los
        canales del Chat interno y los permisos de Documentos.
      </p>

      <form onSubmit={crear} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Vuelos, Simuladores, Ventas..." />
        <button className="btn">Crear</button>
      </form>
      {error && <div className="error-text">{error}</div>}

      <div className="card">
        {areas.map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span>{a.name}</span>
            <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(a.id)}>Eliminar</button>
          </div>
        ))}
        {areas.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Todavía no has creado ningún área.</div>}
      </div>
    </div>
  );
}
