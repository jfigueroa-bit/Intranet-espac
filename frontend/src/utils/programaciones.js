export const TIPOS_SESION = [
  { value: 'TEORIA', label: 'Teoría', color: '#2952cc' },
  { value: 'SIMULADOR', label: 'Simulador', color: '#7b3fa0' },
  { value: 'VUELO', label: 'Vuelo', color: '#2e7d32' },
];
export const COLOR_TIPO_SESION = Object.fromEntries(TIPOS_SESION.map((t) => [t.value, t.color]));
export const LABEL_TIPO_SESION = Object.fromEntries(TIPOS_SESION.map((t) => [t.value, t.label]));
