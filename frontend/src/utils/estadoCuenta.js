export function construirEstadoCuentaHTML({ alumno, cuotas }) {
  const hoy = new Date();

  const filas = cuotas.map((c) => {
    const vencida = !c.paidDate && new Date(c.dueDate) < hoy;
    const estado = c.paidDate ? 'Pagada' : vencida ? 'Vencida' : 'Pendiente';
    return `
      <tr>
        <td>${c.concept}</td>
        <td>S/ ${Number(c.amount).toFixed(2)}</td>
        <td>${new Date(c.dueDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
        <td>${c.paidDate ? new Date(c.paidDate).toLocaleDateString('es-PE') : '—'}</td>
        <td>${estado}</td>
      </tr>
    `;
  }).join('');

  const totalPagado = cuotas.filter((c) => c.paidDate).reduce((s, c) => s + Number(c.amount), 0);
  const totalPendiente = cuotas.filter((c) => !c.paidDate).reduce((s, c) => s + Number(c.amount), 0);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Estado de cuenta - ${alumno.firstName} ${alumno.lastName}</title>
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
  .totales { margin-top: 20px; font-size: 14px; }
  .totales div { margin-bottom: 4px; }
  @media print { body { margin: 0; } .no-imprimir { display: none; } }
</style>
</head>
<body>
  <div class="encabezado">
    <div class="empresa">ESPAC</div>
    <div class="sub">Escuela de Pilotos ESPAC</div>
    <div class="titulo">Estado de cuenta</div>
  </div>

  <div class="datos">
    <strong>${alumno.firstName} ${alumno.lastName}</strong> — ${alumno.code}<br/>
    ${alumno.course ? `Curso: ${alumno.course.name}<br/>` : ''}
    Fecha de emisión: ${hoy.toLocaleDateString('es-PE')}
  </div>

  <table>
    <thead>
      <tr><th>Concepto</th><th>Monto</th><th>Vencimiento</th><th>Fecha de pago</th><th>Estado</th></tr>
    </thead>
    <tbody>
      ${filas || '<tr><td colspan="5">Sin cuotas registradas.</td></tr>'}
    </tbody>
  </table>

  <div class="totales">
    <div><strong>Total pagado:</strong> S/ ${totalPagado.toFixed(2)}</div>
    <div><strong>Total pendiente:</strong> S/ ${totalPendiente.toFixed(2)}</div>
  </div>

  <div class="no-imprimir" style="margin-top:40px; text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px; border-radius:8px; border:none; background:#1c2b4a; color:#fff; cursor:pointer;">Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;
}
