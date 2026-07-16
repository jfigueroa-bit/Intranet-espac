export const DIAS = [
  { key: 'LUN', label: 'Lunes' },
  { key: 'MAR', label: 'Martes' },
  { key: 'MIE', label: 'Miércoles' },
  { key: 'JUE', label: 'Jueves' },
  { key: 'VIE', label: 'Viernes' },
  { key: 'SAB', label: 'Sábado' },
  { key: 'DOM', label: 'Domingo' },
];

export function horarioVacio() {
  return DIAS.map((d) => ({ day: d.key, active: false, start: '08:00', end: '17:00' }));
}
