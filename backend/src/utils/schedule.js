const DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

// Arma un horario "vacío" por defecto: los 7 días, todos inactivos
function horarioVacio() {
  return DIAS.map((day) => ({ day, active: false, start: '08:00', end: '17:00' }));
}

// Valida y limpia lo que llega del frontend, para que siempre queden los 7 días
// en el orden correcto, sin datos raros.
function normalizarHorario(schedule) {
  if (!Array.isArray(schedule)) return horarioVacio();
  return DIAS.map((day) => {
    const existente = schedule.find((d) => d.day === day);
    return {
      day,
      active: !!existente?.active,
      start: existente?.start || '08:00',
      end: existente?.end || '17:00',
    };
  });
}

module.exports = { DIAS, horarioVacio, normalizarHorario };
