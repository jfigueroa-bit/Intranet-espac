// Arma un "reporte de horas" en HTML, listo para ver/imprimir/guardar como PDF
// desde el navegador (mismo patrón que el estado de cuenta y los documentos).

const LABEL_TIPO = { TEORIA: 'Teoría', SIMULADOR: 'Simulador', VUELO: 'Vuelo' };

export function construirReporteHorasHTML({ alumno, sesiones = [], flightLogs = [], simulatorLogs = [] }) {
  const hoy = new Date();

  const sesionesTeoria = sesiones.filter((s) => s.type === 'TEORIA');
  const filasTeoria = sesionesTeoria.map((s) => `
    <tr>
      <td>${new Date(s.date).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
      <td>${s.startTime}–${s.endTime}</td>
      <td>${s.instructor ? `${s.instructor.firstName} ${s.instructor.lastName}` : '—'}</td>
    </tr>
  `).join('');

  const filasVuelos = flightLogs.map((f) => `
    <tr>
      <td>${f.aircraftType?.name || '—'}</td>
      <td>${Number(f.hours).toFixed(1)}</td>
      <td>${new Date(f.date).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
      <td>${f.notes || '—'}</td>
    </tr>
  `).join('');

  const filasSimulador = simulatorLogs.map((s) => `
    <tr>
      <td>${s.simulatorType?.name || '—'}</td>
      <td>${Number(s.hours).toFixed(1)}</td>
      <td>${new Date(s.date).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
      <td>${s.notes || '—'}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Reporte de horas - ${alumno.firstName} ${alumno.lastName}</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #1c1c1e; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 13px; }
  th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e0e0e0; }
  th { color: #6b6b70; text-transform: uppercase; font-size: 11px; letter-spacing: 0.03em; }
  .encabezado { text-align:center; margin-bottom:28px; }
  .encabezado .empresa { font-weight:700; font-size:18px; letter-spacing:0.03em; }
  .encabezado .sub { font-size:13px; color:#6b6b70; margin-bottom:14px; }
  .encabezado .titulo { font-weight:700; font-size:16px; text-transform:uppercase; border-top:2px solid #1c2b4a; border-bottom:2px solid #1c2b4a; padding:8px 0; }
  .datos { font-size: 14px; margin-bottom: 10px; }
  .resumen { display: flex; gap: 24px; margin: 20px 0; }
  .resumen div { flex: 1; text-align: center; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; }
  .resumen .numero { font-size: 22px; font-weight: 700; }
  .resumen .etiqueta { font-size: 11px; color: #6b6b70; text-transform: uppercase; letter-spacing: 0.03em; margin-top: 4px; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; margin: 20px 0 0; }
  @media print { body { margin: 0; } .no-imprimir { display: none; } }
</style>
</head>
<body>
  <div class="encabezado">
    <div class="empresa">ESPAC</div>
    <div class="sub">Escuela de Pilotos ESPAC</div>
    <div class="titulo">Reporte de horas</div>
  </div>

  <div class="datos">
    <strong>${alumno.firstName} ${alumno.lastName}</strong> — ${alumno.code}<br/>
    ${alumno.course ? `Curso: ${alumno.course.name}<br/>` : ''}
    Fecha de emisión: ${hoy.toLocaleDateString('es-PE')}
  </div>

  <div class="resumen">
    <div>
      <div class="numero">${Number(alumno.groundCourseHours).toFixed(1)}</div>
      <div class="etiqueta">Horas de tierra</div>
    </div>
    <div>
      <div class="numero">${Number(alumno.flightHours).toFixed(1)}</div>
      <div class="etiqueta">Horas de vuelo</div>
    </div>
    <div>
      <div class="numero">${Number(alumno.simulatorHours).toFixed(1)}</div>
      <div class="etiqueta">Horas de simulador</div>
    </div>
  </div>

  <h3>Detalle de vuelos</h3>
  ${flightLogs.length > 0 ? `
    <table>
      <thead><tr><th>Avión</th><th>Horas</th><th>Fecha</th><th>Notas</th></tr></thead>
      <tbody>${filasVuelos}</tbody>
    </table>
  ` : '<p style="font-size:13px; color:#6b6b70;">Sin vuelos registrados.</p>'}

  <h3>Detalle de simulador</h3>
  ${simulatorLogs.length > 0 ? `
    <table>
      <thead><tr><th>Simulador</th><th>Horas</th><th>Fecha</th><th>Notas</th></tr></thead>
      <tbody>${filasSimulador}</tbody>
    </table>
  ` : '<p style="font-size:13px; color:#6b6b70;">Sin sesiones de simulador registradas.</p>'}

  <h3>Clases de teoría</h3>
  ${sesionesTeoria.length > 0 ? `
    <table>
      <thead><tr><th>Fecha</th><th>Horario</th><th>Instructor</th></tr></thead>
      <tbody>${filasTeoria}</tbody>
    </table>
  ` : '<p style="font-size:13px; color:#6b6b70;">Sin clases de teoría registradas.</p>'}

  <div class="no-imprimir" style="margin-top:30px; text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px; border-radius:8px; border:none; background:#1c2b4a; color:#fff; cursor:pointer;">Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;
}
