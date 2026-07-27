const SIMBOLO = { PEN: 'S/', USD: '$' };

export function construirBoletaPagoHTML({ alumno, cuota }) {
  const simbolo = SIMBOLO[cuota.currency] || 'S/';
  const emitida = new Date();

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Boleta de pago - ${alumno.firstName} ${alumno.lastName}</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #1c1c1e; max-width: 520px; margin: 40px auto; padding: 0 20px; }
  .encabezado { text-align:center; margin-bottom:26px; }
  .encabezado .empresa { font-weight:700; font-size:18px; letter-spacing:0.03em; }
  .encabezado .sub { font-size:13px; color:#6b6b70; margin-bottom:14px; }
  .encabezado .titulo { font-weight:700; font-size:16px; text-transform:uppercase; border-top:2px solid #1c2b4a; border-bottom:2px solid #1c2b4a; padding:8px 0; }
  .fila { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #e0e0e0; font-size:14px; }
  .fila .etiqueta { color:#6b6b70; }
  .monto { text-align:center; margin:26px 0; }
  .monto .valor { font-size:32px; font-weight:700; }
  .monto .estado { font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--success,#2e7d32); margin-top:4px; }
  @media print { body { margin: 0; } .no-imprimir { display: none; } }
</style>
</head>
<body>
  <div class="encabezado">
    <div class="empresa">ESPAC</div>
    <div class="sub">Escuela de Pilotos ESPAC</div>
    <div class="titulo">Boleta de pago</div>
  </div>

  <div class="monto">
    <div class="valor">${simbolo} ${Number(cuota.amount).toFixed(2)}</div>
    <div class="estado">${cuota.paidDate ? 'Pagado' : 'Pendiente de pago'}</div>
  </div>

  <div class="fila"><span class="etiqueta">Alumno</span><span>${alumno.firstName} ${alumno.lastName} (${alumno.code})</span></div>
  <div class="fila"><span class="etiqueta">Concepto</span><span>${cuota.concept}</span></div>
  <div class="fila"><span class="etiqueta">Fecha de vencimiento</span><span>${new Date(cuota.dueDate).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</span></div>
  <div class="fila"><span class="etiqueta">Fecha de pago</span><span>${cuota.paidDate ? new Date(cuota.paidDate).toLocaleDateString('es-PE') : '—'}</span></div>
  <div class="fila"><span class="etiqueta">Autorizado por</span><span>${cuota.paidBy ? `${cuota.paidBy.firstName} ${cuota.paidBy.lastName}` : '—'}</span></div>
  <div class="fila"><span class="etiqueta">Registrado por</span><span>${cuota.createdBy.firstName} ${cuota.createdBy.lastName}</span></div>
  ${cuota.notes ? `<div class="fila"><span class="etiqueta">Notas</span><span>${cuota.notes}</span></div>` : ''}

  <div style="font-size:11px; color:#9a9a9e; margin-top:20px; text-align:center;">
    Boleta emitida el ${emitida.toLocaleDateString('es-PE')} a las ${emitida.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
  </div>

  <div class="no-imprimir" style="margin-top:30px; text-align:center;">
    <button onclick="window.print()" style="padding:8px 16px; border-radius:8px; border:none; background:#1c2b4a; color:#fff; cursor:pointer;">Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;
}
