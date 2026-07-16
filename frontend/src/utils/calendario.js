export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Convierte una fecha a texto "YYYY-MM-DD" en hora LOCAL (no UTC), para comparar
// días sin líos de zona horaria.
export function aFechaLocal(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Genera las semanas (arrays de 7 días) para mostrar el mes completo,
// incluyendo días grises del mes anterior/siguiente para rellenar la cuadrícula.
export function generarMes(year, month) {
  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);

  // getDay(): 0=domingo...6=sábado. Lo convertimos para que la semana empiece en lunes.
  const offsetInicio = (primerDia.getDay() + 6) % 7;

  const dias = [];
  for (let i = 0; i < offsetInicio; i++) {
    const fecha = new Date(year, month, 1 - (offsetInicio - i));
    dias.push({ fecha, delMes: false });
  }
  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    dias.push({ fecha: new Date(year, month, d), delMes: true });
  }
  while (dias.length % 7 !== 0) {
    const ultima = dias[dias.length - 1].fecha;
    const siguiente = new Date(ultima);
    siguiente.setDate(siguiente.getDate() + 1);
    dias.push({ fecha: siguiente, delMes: false });
  }

  const semanas = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  return semanas;
}
