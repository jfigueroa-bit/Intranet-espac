import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/client';

function TarjetaGrafico({ titulo, children, alto = 280 }) {
  return (
    <div className="card">
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{titulo}</div>
      <div style={{ width: '100%', height: alto }}>
        {children}
      </div>
    </div>
  );
}

export default function Reportes() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports/resumen')
      .then((res) => setDatos(res.data))
      .catch((err) => setError(err.response?.data?.error || 'No se pudieron cargar los reportes'))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando reportes...</div>;
  if (error) return <div className="error-text">{error}</div>;
  if (!datos) return null;

  const hayIngresos = datos.ingresosPorMes.some((m) => m.soles > 0 || m.dolares > 0);
  const hayCursos = datos.cursosPopulares.length > 0;
  const haySesiones = datos.sesionesPorInstructor.length > 0;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>📊 Reportes</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8 }}>
        Un vistazo rápido a cómo va la escuela en los últimos meses.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <TarjetaGrafico titulo="🎓 Alumnos matriculados por mes">
          <ResponsiveContainer>
            <BarChart data={datos.alumnosPorMes}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="alumnos" fill="#1c2b4a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafico>

        <TarjetaGrafico titulo="💰 Ingresos por mes (pagos cobrados)">
          {hayIngresos ? (
            <ResponsiveContainer>
              <BarChart data={datos.ingresosPorMes}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="soles" name="Soles (S/)" fill="#2e7d32" radius={[6, 6, 0, 0]} />
                <Bar dataKey="dolares" name="Dólares ($)" fill="#7b3fa0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
              Todavía no hay pagos cobrados en este periodo.
            </div>
          )}
        </TarjetaGrafico>

        <TarjetaGrafico titulo="📚 Cursos con más alumnos">
          {hayCursos ? (
            <ResponsiveContainer>
              <BarChart data={datos.cursosPopulares} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="curso" fontSize={12} width={120} />
                <Tooltip />
                <Bar dataKey="alumnos" fill="#2952cc" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
              Todavía no hay cursos con alumnos matriculados.
            </div>
          )}
        </TarjetaGrafico>

        <TarjetaGrafico titulo="🗓️ Sesiones programadas por instructor (últimos 30 días)">
          {haySesiones ? (
            <ResponsiveContainer>
              <BarChart data={datos.sesionesPorInstructor} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="instructor" fontSize={12} width={120} />
                <Tooltip />
                <Bar dataKey="sesiones" fill="#a6650a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay sesiones programadas en los últimos 30 días.
            </div>
          )}
        </TarjetaGrafico>
      </div>
    </div>
  );
}
