import { useEffect, useState } from 'react';
import api from '../api/client';
import { DIAS, horarioVacio } from '../utils/dias';

export default function Horarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [horario, setHorario] = useState(horarioVacio());
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await api.get('/users');
    setUsuarios(data);
  }

  function seleccionar(u) {
    setSeleccionadoId(u.id);
    setGuardado(false);
    const base = horarioVacio();
    const conDatos = base.map((dia) => {
      const existente = (u.schedule || []).find((d) => d.day === dia.day);
      return existente ? { ...dia, ...existente } : dia;
    });
    setHorario(conDatos);
    setNota(u.scheduleNote || '');
  }

  function actualizarDia(dayKey, campo, valor) {
    setHorario((h) => h.map((d) => (d.day === dayKey ? { ...d, [campo]: valor } : d)));
  }

  async function guardar() {
    setGuardando(true);
    setGuardado(false);
    try {
      await api.patch(`/users/${seleccionadoId}/horario`, { schedule: horario, scheduleNote: nota });
      setGuardado(true);
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  const seleccionado = usuarios.find((u) => u.id === seleccionadoId);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Horarios</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Solo Administración y Recursos Humanos pueden asignar el horario semanal de cada
        persona. Elige a alguien de la lista, marca sus días activos con su hora de entrada
        y salida, y guarda — lo verá directo en su "Mi Perfil".
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 8 }}>
          {usuarios.map((u) => (
            <div
              key={u.id}
              onClick={() => seleccionar(u)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                background: seleccionadoId === u.id ? 'var(--primary)' : 'transparent',
                color: seleccionadoId === u.id ? '#fff' : 'var(--text)',
              }}
            >
              {u.firstName} {u.lastName}
              <div style={{ fontSize: 12, opacity: 0.75 }}>{u.cargo || 'Sin cargo'}</div>
            </div>
          ))}
          {usuarios.length === 0 && <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>No hay usuarios todavía.</div>}
        </div>

        <div className="card">
          {!seleccionado && (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Selecciona a alguien de la lista para ver o editar su horario.
            </div>
          )}

          {seleccionado && (
            <>
              <h3 style={{ marginTop: 0 }}>{seleccionado.firstName} {seleccionado.lastName}</h3>

              <table>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Trabaja</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {DIAS.map(({ key, label }) => {
                    const dia = horario.find((d) => d.day === key) || {};
                    return (
                      <tr key={key}>
                        <td>{label}</td>
                        <td>
                          <input
                            type="checkbox"
                            style={{ width: 'auto' }}
                            checked={!!dia.active}
                            onChange={(e) => actualizarDia(key, 'active', e.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={dia.start || '08:00'}
                            disabled={!dia.active}
                            onChange={(e) => actualizarDia(key, 'start', e.target.value)}
                            style={{ maxWidth: 120 }}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={dia.end || '17:00'}
                            disabled={!dia.active}
                            onChange={(e) => actualizarDia(key, 'end', e.target.value)}
                            style={{ maxWidth: 120 }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="field" style={{ marginTop: 16 }}>
                <label>Nota adicional (opcional)</label>
                <input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej: Turno rotativo cada 2 semanas, horario de refrigerio 1-2pm..."
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <button className="btn" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar horario'}
                </button>
                {guardado && <span style={{ color: 'var(--success)', fontSize: 13 }}>Guardado ✓</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
