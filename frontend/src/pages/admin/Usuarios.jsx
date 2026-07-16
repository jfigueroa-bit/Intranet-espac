import { useEffect, useState } from 'react';
import api from '../../api/client';

const ROLES = ['ADMIN', 'GERENCIA', 'RRHH', 'MARKETING', 'VENTAS', 'INSTRUCTOR', 'EMPLEADO'];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', cargo: '', role: 'EMPLEADO', areaIds: [] });
  const [credencialCreada, setCredencialCreada] = useState(null);
  const [credencialReset, setCredencialReset] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [u, a] = await Promise.all([api.get('/users'), api.get('/areas')]);
    setUsuarios(u.data);
    setAreas(a.data);
  }

  function toggleArea(areaId) {
    setForm((f) => ({
      ...f,
      areaIds: f.areaIds.includes(areaId) ? f.areaIds.filter((id) => id !== areaId) : [...f.areaIds, areaId],
    }));
  }

  async function crearUsuario(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const { data } = await api.post('/users', form);
      setCredencialCreada({ username: data.user.username, password: data.passwordTemporal });
      setForm({ firstName: '', lastName: '', email: '', cargo: '', role: 'EMPLEADO', areaIds: [] });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el usuario');
    } finally {
      setGuardando(false);
    }
  }

  async function resetPassword(id) {
    const { data } = await api.post(`/users/${id}/reset-password`);
    setCredencialReset({ id, password: data.passwordTemporal });
  }

  async function actualizarRol(id, role) {
    await api.patch(`/users/${id}`, { role });
    cargar();
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Usuarios</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Crear usuario nuevo</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          El usuario y la contraseña temporal se generan automáticamente. Comparte esos
          datos con la persona; al ingresar por primera vez le pedirá crear su propia contraseña.
        </p>
        <form onSubmit={crearUsuario}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Nombre(s)</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div className="field">
              <label>Apellido</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <div className="field">
              <label>Correo institucional</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Cargo</label>
              <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ej: Asesora de Ventas" />
            </div>
            <div className="field">
              <label>Rol en el sistema</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Áreas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {areas.map((a) => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, width: 'auto' }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={form.areaIds.includes(a.id)} onChange={() => toggleArea(a.id)} />
                    {a.name}
                  </label>
                ))}
                {areas.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crea áreas primero en "Áreas / Tags"</span>}
              </div>
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" style={{ marginTop: 12 }} disabled={guardando}>
            {guardando ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>

        {credencialCreada && (
          <div className="card" style={{ marginTop: 16, background: '#f5f7ff' }}>
            <strong>Usuario creado:</strong> {credencialCreada.username}<br />
            <strong>Contraseña temporal:</strong> {credencialCreada.password}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>
              Guarda o comparte estos datos ahora — no se volverán a mostrar.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Listado de usuarios</h3>
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Cargo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.firstName} {u.lastName}</td>
                <td>
                  <select value={u.role} onChange={(e) => actualizarRol(u.id, e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.cargo || '—'}</td>
                <td>
                  <button className="btn secondary" onClick={() => resetPassword(u.id)}>
                    Restablecer contraseña
                  </button>
                  {credencialReset?.id === u.id && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Nueva contraseña: <strong>{credencialReset.password}</strong>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
