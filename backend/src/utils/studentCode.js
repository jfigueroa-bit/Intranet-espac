const prisma = require('../lib/prisma');

// Da el siguiente código disponible, tipo ESPAC-00001, ESPAC-00002...
async function siguienteCodigoAlumno() {
  const ultimo = await prisma.student.findFirst({ orderBy: { sequenceNumber: 'desc' } });
  const sequenceNumber = (ultimo?.sequenceNumber || 0) + 1;
  const code = `ESPAC-${String(sequenceNumber).padStart(5, '0')}`;
  return { sequenceNumber, code };
}

module.exports = { siguienteCodigoAlumno };
