export function construirReporteHorasHTML({ alumno, sesiones = [] }) {
  const hoy = new Date();

  const filasSesiones = sesiones.map((s) => `
    <tr>
      <td>${LABEL_TIPO[s.type] || s.type}</td>
      <td>${new Date(s.date).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
      <td>${s.startTime}–${s.endTime}</td>
      <td>${s.instructor ? `${s.instructor.firstName} ${s.instructor.lastName}` : '—'}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Reporte de horas - ${alumno.firstName} ${alumno.lastName}</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #1c1c1e; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
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

  ${sesiones.length > 0 ? `
    <table>
      <thead>
        <tr><th>Tipo</th><th>Fecha</th><th>Horario</th><th>Instructor</th></tr>
      </thead>
      <tbody>
        ${filasSesiones}
      </tbody>
    </table>
  ` : '<p style="font-size:13px; color:#6b6b70;">Sin sesiones programadas registradas.</p>'}

  <div class="no-imprimir" style="margin-top:40px; text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px; border-radius:8px; border:none; background:#1c2b4a; color:#fff; cursor:pointer;">Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;
}

const LABEL_TIPO = { TEORIA: 'Teoría', SIMULADOR: 'Simulador', VUELO: 'Vuelo' };
