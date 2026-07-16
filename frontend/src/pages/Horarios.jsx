import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Horarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [edit, setEdit] = useState({}); // { [userId]: { scheduleUrl, scheduleNote } }
  const [guardandoId, setGuardandoId] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await api.get('/users');
    setUsuarios(data);
    const inicial = {};
    data.forEach((u) => {
      inicial[u.id] = { scheduleUrl: u.scheduleUrl || '', scheduleNote: u.scheduleNote || '' };
    });
    setEdit(inicial);
  }

  function actualizarCampo(id, campo, valor) {
    setEdit((e) => ({ ...e, [id]: { ...e[id], [campo]: valor } }));
  }

  async function guardar(id) {
    setGuardandoId(id);
    try {
      await api.patch(`/users/${id}/horario`, edit[id]);
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Horarios</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Solo Administración y Recursos Humanos pueden subir o cambiar el horario de cada
        persona. Puedes poner un link a un archivo (Drive, PDF, etc.) y/o una nota escrita;
        cada persona lo verá en su "Mi Perfil".
      </p>

      <div className="card">
        {usuarios.map((u) => (
          <div key={u.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {u.firstName} {u.lastName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {u.cargo || 'Sin cargo'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Link del horario (opcional)</label>
                <input
                  value={edit[u.id]?.scheduleUrl || ''}
                  onChange={(e) => actualizarCampo(u.id, 'scheduleUrl', e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Nota / horario en texto (opcional)</label>
                <input
                  value={edit[u.id]?.scheduleNote || ''}
                  onChange={(e) => actualizarCampo(u.id, 'scheduleNote', e.target.value)}
                  placeholder="Lun a Vie, 8:00am - 5:00pm"
                />
              </div>
              <button className="btn" onClick={() => guardar(u.id)} disabled={guardandoId === u.id}>
                {guardandoId === u.id ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        ))}
        {usuarios.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No hay usuarios todavía.</div>}
      </div>
    </div>
  );
}
