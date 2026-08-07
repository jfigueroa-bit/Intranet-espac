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

// GET /api/schedules/bloques -> todos los eventos/notas de varios días (cualquiera los puede ver)
router.get('/bloques', requireAuth, async (req, res) => {
  const bloques = await prisma.scheduleBlockNote.findMany({
    include: { createdBy: { select: PERSONA_INFO } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bloques);
});

// POST /api/schedules/bloques -> crea un evento/nota sobre un conjunto de días
router.post('/bloques', requireAuth, requireGestionarBloques, async (req, res) => {
  const { title, description, dates } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Falta el título' });
  if (!Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'Elige al menos un día' });
  }

  const bloque = await prisma.scheduleBlockNote.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      dates,
      createdById: req.user.id,
    },
    include: { createdBy: { select: PERSONA_INFO } },
  });

  res.status(201).json(bloque);
});

// PATCH /api/schedules/bloques/:id -> edita un evento de varios días (su creador o Admin)
router.patch('/bloques/:id', requireAuth, requireGestionarBloques, async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, dates } = req.body;

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

  const actualizado = await prisma.scheduleBlockNote.update({
    where: { id },
    data,
    include: { createdBy: { select: PERSONA_INFO } },
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
