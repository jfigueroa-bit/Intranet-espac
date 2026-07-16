import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { MESES, DIAS_SEMANA, aFechaLocal, generarMes } from '../utils/calendario';

const COLORES = ['#1c2b4a', '#2e7d32', '#c9a227', '#b3261e', '#2952cc', '#7b3fa0'];

export default function Calendario() {
  const { user } = useAuth();
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());
  const [eventos, setEventos] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', color: COLORES[0] });
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await api.get('/events');
    setEventos(data);
  }

  const semanas = useMemo(() => generarMes(year, month), [year, month]);

  const eventosPorDia = useMemo(() => {
    const mapa = {};
    eventos.forEach((ev) => {
      const key = aFechaLocal(ev.date);
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(ev);
    });
    return mapa;
  }, [eventos]);

  const proximos = useMemo(() => {
    const hoyKey = aFechaLocal(new Date());
    return eventos.filter((ev) => aFechaLocal(ev.date) >= hoyKey).slice(0, 6);
  }, [eventos]);

  function cambiarMes(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
    setDiaSeleccionado(null);
  }

  function seleccionarDia(fecha) {
    setDiaSeleccionado(aFechaLocal(fecha));
    setForm({ title: '', description: '', color: COLORES[0] });
    setError('');
  }

  async function crearEvento(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/events', { ...form, date: diaSeleccionado });
      setForm({ title: '', description: '', color: COLORES[0] });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo agregar la fecha');
    }
  }

  async function eliminarEvento(id) {
    if (!confirm('¿Eliminar este evento?')) return;
    await api.delete(`/events/${id}`);
    cargar();
  }

  const hoyKey = aFechaLocal(new Date());
  const eventosDelDiaSeleccionado = diaSeleccionado ? eventosPorDia[diaSeleccionado] || [] : [];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Calendario</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Fechas importantes de la compañía. Haz clic en un día para ver o agregar eventos.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button className="btn secondary" onClick={() => cambiarMes(-1)}>← Anterior</button>
            <h3 style={{ margin: 0 }}>{MESES[month]} {year}</h3>
            <button className="btn secondary" onClick={() => cambiarMes(1)}>Siguiente →</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DIAS_SEMANA.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>
                {d}
              </div>
            ))}
            {semanas.flat().map(({ fecha, delMes }, i) => {
              const key = aFechaLocal(fecha);
              const eventosDia = eventosPorDia[key] || [];
              const esHoy = key === hoyKey;
              const seleccionado = key === diaSeleccionado;
              return (
                <div
                  key={i}
                  onClick={() => seleccionarDia(fecha)}
                  style={{
                    minHeight: 70, padding: 6, borderRadius: 8, cursor: 'pointer',
                    border: seleccionado ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: delMes ? '#fff' : '#fafafa',
                    opacity: delMes ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: esHoy ? 700 : 400, color: esHoy ? 'var(--primary)' : 'var(--text)' }}>
                    {fecha.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                    {eventosDia.slice(0, 2).map((ev) => (
                      <div key={ev.id} style={{ fontSize: 10, background: ev.color, color: '#fff', borderRadius: 4, padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                    ))}
                    {eventosDia.length > 2 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{eventosDia.length - 2} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Próximos eventos</h3>
            {proximos.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay eventos próximos.</div>}
            {proximos.map((ev) => (
              <div key={ev.id} style={{ marginBottom: 8, fontSize: 13 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ev.color, marginRight: 6 }} />
                <strong>{new Date(ev.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</strong> — {ev.title}
              </div>
            ))}
          </div>

          {diaSeleccionado && (
            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: 14 }}>
                {new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>

              {eventosDelDiaSeleccionado.map((ev) => (
                <div key={ev.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                  {ev.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.description}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Agregado por {ev.createdBy.firstName} {ev.createdBy.lastName}</div>
                  {(user?.id === ev.createdById || user?.role === 'ADMIN') && (
                    <button className="btn danger" style={{ padding: '2px 8px', fontSize: 11, marginTop: 4 }} onClick={() => eliminarEvento(ev.id)}>
                      Eliminar
                    </button>
                  )}
                </div>
              ))}

              <form onSubmit={crearEvento}>
                <div className="field">
                  <label>Título</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Descripción (opcional)</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="field">
                  <label>Color</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {COLORES.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: form.color === c ? '2px solid var(--primary)' : '1px solid var(--border)', padding: 0 }}
                      />
                    ))}
                  </div>
                </div>
                {error && <div className="error-text">{error}</div>}
                <button className="btn" style={{ marginTop: 8 }}>Agregar a este día</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
