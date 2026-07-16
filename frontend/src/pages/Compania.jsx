import { useEffect, useState } from 'react';
import api from '../api/client';
import AreaChip from '../components/AreaChip.jsx';

const ESTADO_LABEL = { PRESENCIAL: 'Presencial', HOME_OFFICE: 'Home Office', VACACIONES: 'Vacaciones' };

export default function Compania() {
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    api.get('/users').then((res) => setUsuarios(res.data));
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Compañía</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Directorio de todo el personal de ESPAC, ordenado según la jerarquía definida por Admin.
      </p>

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
            {usuarios.map((u) => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
