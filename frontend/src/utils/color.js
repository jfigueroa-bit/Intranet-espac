// Dado un color de fondo (#rrggbb), decide si el texto debe ser blanco o negro
// para que se pueda leer bien.
export function colorTextoLegible(hex) {
  if (!hex) return '#fff';
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? '#1c1c1e' : '#ffffff';
}
