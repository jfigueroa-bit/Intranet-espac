const prisma = require('../lib/prisma');

// Convierte "YYYY-MM-DD" a mediodía UTC de ESE día (mismo truco que usamos en
// Calendario, para que no se desfase un día por la zona horaria).
function fechaSoloDia(texto) {
  const [y, m, d] = texto.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

// Devuelve el set de ids de usuarios que HOY están dentro de una solicitud de
// vacaciones ya aprobada. Esto se calcula al vuelo cada vez que se pide (no se
// guarda nada por cron), así que el estado "De vacaciones" aparece y desaparece
// solo, el día que corresponde.
async function idsDeVacacionesHoy() {
  const hoyTexto = new Date().toISOString().slice(0, 10);
  const hoy = fechaSoloDia(hoyTexto);

  const activas = await prisma.vacationRequest.findMany({
    where: { status: 'APROBADA', startDate: { lte: hoy }, endDate: { gte: hoy } },
    select: { userId: true },
  });

  return new Set(activas.map((v) => v.userId));
}

module.exports = { idsDeVacacionesHoy, fechaSoloDia };
