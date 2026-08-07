const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { notificar } = require('../utils/socket');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true, cargo: true };
const INCLUIR = {
  student: { select: { id: true, code: true, firstName: true, lastName: true } },
  instructor: { select: PERSONA_INFO },
  createdBy: { select: PERSONA_INFO },
  promotion: true,
};

const TIPOS_VALIDOS = ['TEORIA', 'SIMULADOR', 'VUELO'];
const TIPOS_LABEL = { TEORIA: 'Teoría', SIMULADOR: 'Simulador', VUELO: 'Vuelo' };

// Convierte "YYYY-MM-DD" a mediodía UTC de ese día, para que no se desfase por zona horaria
function fechaSoloDia(texto) {
  const [y, m, d] = texto.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

// Admin siempre puede; cualquier otra persona necesita el permiso individual
// "canManageScheduleBlocks", que un Admin le otorga a mano desde Usuarios
// (pensado sobre todo para el rol SECRETARIA).
async function requireGestionarBloques(req, res, next) {
  if (req.user.role === 'ADMIN') return next();
  const yo = await prisma.user.findUnique({ where: { id: req.user.id }, select: { canManageScheduleBlocks: true } });
  if (yo?.canManageScheduleBlocks) return next();
  return res.status(403).json({ error: 'No tienes permiso para crear eventos de varios días en Programaciones' });
}

// GET /api/schedules -> todas las sesiones (cualquier usuario logueado las puede ver)
router.get('/', requireAuth, async (req, res) => {
  const { instructorId, studentId } = req.query;
  const where = {};
  if (instructorId) where.instructorId = Number(instructorId);
  if (studentId) where.studentId = Number(studentId);

  const sesiones = await prisma.scheduleSession.findMany({
    where,
    include: INCLUIR,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  res.json(sesiones);
});

// POST /api/schedules -> programa una sesión nueva y notifica al instructor
router.post('/', requireAuth, requireRole('ADMIN', 'GERENCIA', 'INSTRUCTOR'), async (req, res) => {
  const { type, date, startTime, endTime, studentId, instructorId, notes } = req.body;

  if (!TIPOS_VALIDOS.includes(type)) return res.status(400).json({ error: 'Tipo de sesión no válido' });
  if (!date || !startTime || !endTime) return res.status(400).json({ error: 'Faltan la fecha y los horarios' });
  if (!studentId || !instructorId) return res.status(400).json({ error: 'Faltan el alumno y el instructor' });

  const sesion = await prisma.scheduleSession.create({
    data: {
      type,
      date: fechaSoloDia(date),
      startTime,
      endTime,
      studentId: Number(studentId),
      instructorId: Number(instructorId),
      notes: notes || null,
      createdById: req.user.id,
    },
    include: INCLUIR,
  });

  const fechaTexto = sesion.date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  await notificar({
    userId: sesion.instructorId,
    type: 'PROGRAMACION',
    title: 'Nueva sesión programada',
    message: `${TIPOS_LABEL[type]} con ${sesion.student.firstName} ${sesion.student.lastName} el ${fechaTexto}, ${startTime}-${endTime}.`,
    link: '/programaciones',
  });

  res.status(201).json(sesion);
});

// PATCH /api/schedules/:id -> edita una sesión
router.patch('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'INSTRUCTOR'), async (req, res) => {
  const id = Number(req.params.id);
  const { type, date, startTime, endTime, studentId, instructorId, notes } = req.body;

  const data = {};
  if (type !== undefined) {
    if (!TIPOS_VALIDOS.includes(type)) return res.status(400).json({ error: 'Tipo de sesión no válido' });
    data.type = type;
  }
  if (date !== undefined) data.date = fechaSoloDia(date);
  if (startTime !== undefined) data.startTime = startTime;
  if (endTime !== undefined) data.endTime = endTime;
  if (studentId !== undefined) data.studentId = Number(studentId);
  if (instructorId !== undefined) data.instructorId = Number(instructorId);
  if (notes !== undefined) data.notes = notes || null;

  const actualizada = await prisma.scheduleSession.update({ where: { id }, data, include: INCLUIR });
  res.json(actualizada);
});

// DELETE /api/schedules/:id -> cancela/elimina una sesión, y avisa al instructor
router.delete('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'INSTRUCTOR'), async (req, res) => {
  const id = Number(req.params.id);
  const sesion = await prisma.scheduleSession.findUnique({ where: { id }, include: INCLUIR });
  if (!sesion) return res.status(404).json({ error: 'No encontrada' });

  await prisma.scheduleSession.delete({ where: { id } });

  const fechaTexto = sesion.date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  await notificar({
    userId: sesion.instructorId,
    type: 'PROGRAMACION',
    title: 'Sesión cancelada',
    message: `Se canceló la sesión de ${TIPOS_LABEL[sesion.type]} con ${sesion.student.firstName} ${sesion.student.lastName} del ${fechaTexto}.`,
    link: '/programaciones',
  });

  res.json({ ok: true });
});

const INCLUIR_BLOQUE = { createdBy: { select: PERSONA_INFO }, promotion: { include: { course: true } } };

// POST /api/schedules/promocion -> programa la MISMA sesión para todos los alumnos
// activos de una promoción de una sola vez: crea una ScheduleSession por alumno
// (marcada con promotionId) y, según el tipo, el registro de horas correspondiente
// (vuelo/simulador/teoría), igual que si se hubiera programado uno por uno.
router.post('/promocion', requireAuth, requireRole('ADMIN', 'GERENCIA', 'INSTRUCTOR'), async (req, res) => {
  const {
    promotionId, type, date, startTime, endTime, instructorId, notes,
    aircraftTypeId, simulatorTypeId, theoryTopicId,
  } = req.body;

  if (!promotionId) return res.status(400).json({ error: 'Elige una promoción' });
  if (!TIPOS_VALIDOS.includes(type)) return res.status(400).json({ error: 'Tipo de sesión no válido' });
  if (!date || !startTime || !endTime) return res.status(400).json({ error: 'Faltan la fecha y los horarios' });
  if (!instructorId) return res.status(400).json({ error: 'Falta el instructor' });
  if (type === 'VUELO' && !aircraftTypeId) return res.status(400).json({ error: 'Elige el tipo de avión' });
  if (type === 'SIMULADOR' && !simulatorTypeId) return res.status(400).json({ error: 'Elige el tipo de simulador' });
  if (type === 'TEORIA' && !theoryTopicId) return res.status(400).json({ error: 'Elige el tema de teoría' });

  const promocion = await prisma.promotion.findUnique({ where: { id: Number(promotionId) } });
  if (!promocion) return res.status(404).json({ error: 'Promoción no encontrada' });

  const alumnos = await prisma.student.findMany({
    where: { promotionId: Number(promotionId), isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (alumnos.length === 0) {
    return res.status(400).json({ error: 'Esta promoción no tiene alumnos activos' });
  }

  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  const horas = Math.max((h2 * 60 + m2) - (h1 * 60 + m1), 0) / 60;
  const fecha = fechaSoloDia(date);

  const sesiones = [];
  for (const alumno of alumnos) {
    const operaciones = [
      prisma.scheduleSession.create({
        data: {
          type,
          date: fecha,
          startTime,
          endTime,
          studentId: alumno.id,
          instructorId: Number(instructorId),
          notes: notes || null,
          promotionId: Number(promotionId),
          createdById: req.user.id,
        },
        include: INCLUIR,
      }),
    ];

    if (type === 'VUELO') {
      operaciones.push(
        prisma.flightLogEntry.create({
          data: { studentId: alumno.id, aircraftTypeId: Number(aircraftTypeId), hours: horas, date: fecha, notes: notes || `Programado con ${promocion.name}`, createdById: req.user.id },
        }),
        prisma.student.update({ where: { id: alumno.id }, data: { flightHours: { increment: horas } } })
      );
    } else if (type === 'SIMULADOR') {
      operaciones.push(
        prisma.simulatorLogEntry.create({
          data: { studentId: alumno.id, simulatorTypeId: Number(simulatorTypeId), hours: horas, date: fecha, notes: notes || `Programado con ${promocion.name}`, createdById: req.user.id },
        }),
        prisma.student.update({ where: { id: alumno.id }, data: { simulatorHours: { increment: horas } } })
      );
    } else if (type === 'TEORIA') {
      operaciones.push(
        prisma.theoryLogEntry.create({
          data: { studentId: alumno.id, theoryTopicId: Number(theoryTopicId), hours: horas, date: fecha, notes: notes || `Programado con ${promocion.name}`, createdById: req.user.id },
        }),
        prisma.student.update({ where: { id: alumno.id }, data: { groundCourseHours: { increment: horas } } })
      );
    }

    const [sesion] = await prisma.$transaction(operaciones);
    sesiones.push(sesion);
  }

  const fechaTexto = fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  await notificar({
    userId: Number(instructorId),
    type: 'PROGRAMACION',
    title: 'Sesión programada para una promoción completa',
    message: `${TIPOS_LABEL[type]} con ${promocion.name} (${alumnos.length} alumnos) el ${fechaTexto}, ${startTime}-${endTime}.`,
    link: '/programaciones',
  });

  res.status(201).json({ promotion: promocion, cantidadAlumnos: alumnos.length, sesiones });
});

// GET /api/schedules/bloques -> todos los eventos/notas de varios días (cualquiera los puede ver)
router.get('/bloques', requireAuth, async (req, res) => {
  const bloques = await prisma.scheduleBlockNote.findMany({
    include: INCLUIR_BLOQUE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(bloques);
});

// POST /api/schedules/bloques -> crea un evento/nota sobre un conjunto de días
// (opcionalmente dirigido a una promoción específica, con promotionId)
router.post('/bloques', requireAuth, requireGestionarBloques, async (req, res) => {
  const { title, description, dates, promotionId } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Falta el título' });
  if (!Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'Elige al menos un día' });
  }

  const bloque = await prisma.scheduleBlockNote.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      dates,
      promotionId: promotionId ? Number(promotionId) : null,
      createdById: req.user.id,
    },
    include: INCLUIR_BLOQUE,
  });

  res.status(201).json(bloque);
});

// PATCH /api/schedules/bloques/:id -> edita un evento de varios días (su creador o Admin)
router.patch('/bloques/:id', requireAuth, requireGestionarBloques, async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, dates, promotionId } = req.body;

  const existente = await prisma.scheduleBlockNote.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'ADMIN' && existente.createdById !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes editar los eventos que tú creaste' });
  }

  const data = {};
  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ error: 'El título no puede quedar vacío' });
    data.title = title.trim();
  }
  if (description !== undefined) data.description = description?.trim() || null;
  if (dates !== undefined) {
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'Elige al menos un día' });
    }
    data.dates = dates;
  }
  if (promotionId !== undefined) data.promotionId = promotionId ? Number(promotionId) : null;

  const actualizado = await prisma.scheduleBlockNote.update({
    where: { id },
    data,
    include: INCLUIR_BLOQUE,
  });
  res.json(actualizado);
});

// DELETE /api/schedules/bloques/:id -> elimina un evento de varios días (su creador o Admin)
router.delete('/bloques/:id', requireAuth, requireGestionarBloques, async (req, res) => {
  const id = Number(req.params.id);
  const existente = await prisma.scheduleBlockNote.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'ADMIN' && existente.createdById !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes eliminar los eventos que tú creaste' });
  }
  await prisma.scheduleBlockNote.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
