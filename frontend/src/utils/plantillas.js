// Cada plantilla sabe generar un documento HTML (con estilo listo para imprimir /
// guardar como PDF desde el navegador) a partir de los datos de un formulario.
// Para agregar una plantilla nueva en el futuro (ej: "Constancia de trabajo"),
// solo hay que sumar una entrada aquí con su lista de "campos" y su función "generar".

function encabezado(titulo) {
  return `
    <div style="text-align:center; margin-bottom:28px;">
      <div style="font-weight:700; font-size:18px; letter-spacing:0.03em;">ESPAC</div>
      <div style="font-size:13px; color:#6b6b70; margin-bottom:14px;">Escuela de Pilotos ESPAC</div>
      <div style="font-weight:700; font-size:16px; text-transform:uppercase; border-top:2px solid #1c2b4a; border-bottom:2px solid #1c2b4a; padding:8px 0;">${titulo}</div>
    </div>
  `;
}

function firma(nombre, rol) {
  return `
    <div style="text-align:center; width:220px;">
      <div style="border-top:1px solid #1c1c1e; margin-top:50px; padding-top:6px; font-size:13px;">${nombre}</div>
      <div style="font-size:11px; color:#6b6b70;">${rol}</div>
    </div>
  `;
}

function documentoBase(contenidoHTML) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Documento ESPAC</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #1c1c1e; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 0; font-size: 14px; vertical-align: top; }
  td.label { width: 180px; color: #6b6b70; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
  .firmas { display: flex; justify-content: space-between; margin-top: 60px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${contenidoHTML}
<div style="margin-top:40px; text-align:right;">
  <button onclick="window.print()" style="padding:8px 16px; border-radius:8px; border:none; background:#1c2b4a; color:#fff; cursor:pointer;">Imprimir / Guardar como PDF</button>
</div>
</body>
</html>`;
}

export const PLANTILLAS = [
  {
    id: 'acta-prestamo-equipo',
    nombre: 'Acta de préstamo de equipo',
    campos: [
      { key: 'equipo', label: 'Equipo entregado', placeholder: 'Ej: Laptop Dell Latitude 5420, serie XYZ123' },
      { key: 'condiciones', label: 'Condiciones / observaciones (opcional)', placeholder: 'Ej: Se entrega con cargador. Debe devolverse en buen estado.' },
    ],
    generar: ({ empleadoNombre, empleadoCargo, entregadoPorNombre, fecha, campos }) => {
      const fechaTexto = new Date(fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
      const cuerpo = `
        ${encabezado('Acta de préstamo de equipo')}
        <p style="font-size:14px;">
          Por medio del presente documento se deja constancia de la entrega, en calidad de préstamo,
          del equipo descrito a continuación a favor de <strong>${empleadoNombre}</strong>${empleadoCargo ? ` (${empleadoCargo})` : ''},
          con fecha <strong>${fechaTexto}</strong>.
        </p>
        <table>
          <tr><td class="label">Equipo entregado</td><td>${campos.equipo || '—'}</td></tr>
          <tr><td class="label">Condiciones / observaciones</td><td>${campos.condiciones || '—'}</td></tr>
          <tr><td class="label">Fecha</td><td>${fechaTexto}</td></tr>
        </table>
        <p style="font-size:13px; color:#6b6b70;">
          El colaborador se compromete a hacer buen uso del equipo y a devolverlo en las mismas
          condiciones en las que lo recibió, salvo el desgaste propio del uso normal.
        </p>
        <div class="firmas">
          ${firma(empleadoNombre, 'Recibe')}
          ${firma(entregadoPorNombre, 'Entrega')}
        </div>
      `;
      return documentoBase(cuerpo);
    },
  },
];
