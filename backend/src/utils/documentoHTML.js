// Arma el documento final en HTML una vez que ya firmaron todos los que debían firmar.
// Espejo del utils/documentoHTML.js del frontend, pero en CommonJS para el backend.

function bloqueFirma(firmante) {
  if (!firmante) return '<div style="width:220px;"></div>';
  return `
    <div style="text-align:center; width:220px;">
      ${firmante.firma
        ? `<img src="${firmante.firma}" alt="Firma" style="max-height:60px; max-width:200px; display:block; margin:0 auto;" />`
        : '<div style="height:60px;"></div>'
      }
      <div style="border-top:1px solid #1c1c1e; margin-top:6px; padding-top:6px; font-size:13px;">${firmante.nombre}</div>
      <div style="font-size:11px; color:#6b6b70;">${firmante.cargo || ''}</div>
    </div>
  `;
}

function construirDocumentoHTML({ nombrePlantilla, introTexto, camposTabla = [], imageData, firmante1, firmante2 }) {
  const filasTabla = camposTabla
    .filter((c) => c.value)
    .map((c) => `<tr><td class="label">${c.label}</td><td>${c.value}</td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${nombrePlantilla}</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #1c1c1e; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 0; font-size: 14px; vertical-align: top; }
  td.label { width: 200px; color: #6b6b70; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
  .firmas { display: flex; justify-content: space-around; gap: 20px; margin-top: 60px; }
  .encabezado { text-align:center; margin-bottom:28px; }
  .encabezado .empresa { font-weight:700; font-size:18px; letter-spacing:0.03em; }
  .encabezado .sub { font-size:13px; color:#6b6b70; margin-bottom:14px; }
  .encabezado .titulo { font-weight:700; font-size:16px; text-transform:uppercase; border-top:2px solid #1c2b4a; border-bottom:2px solid #1c2b4a; padding:8px 0; }
  .intro { font-size:14px; white-space: pre-wrap; }
  .imagen-adjunta { max-width: 100%; border-radius: 8px; margin: 16px 0; }
  @media print { body { margin: 0; } .no-imprimir { display: none; } }
</style>
</head>
<body>
  <div class="encabezado">
    <div class="empresa">ESPAC</div>
    <div class="sub">Escuela de Pilotos ESPAC</div>
    <div class="titulo">${nombrePlantilla}</div>
  </div>

  <p class="intro">${introTexto}</p>

  ${filasTabla ? `<table>${filasTabla}</table>` : ''}

  ${imageData ? `<img class="imagen-adjunta" src="${imageData}" alt="Imagen adjunta" />` : ''}

  <div class="firmas">
    ${bloqueFirma(firmante1)}
    ${bloqueFirma(firmante2)}
  </div>

  <div class="no-imprimir" style="margin-top:40px; text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px; border-radius:8px; border:none; background:#1c2b4a; color:#fff; cursor:pointer;">Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;
}

function reemplazarTokens(texto, valores) {
  return texto.replace(/\{\{(\w+)\}\}/g, (match, clave) => (valores[clave] !== undefined ? valores[clave] : match));
}

module.exports = { construirDocumentoHTML, reemplazarTokens };
