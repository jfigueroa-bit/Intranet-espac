const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true };
const INCLUIR = {
  theoryTopic: true,
  createdBy: { select: PERSONA_INFO },
};

router.get('/', requireAuth, async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Falta indicar el alumno' });

  const registros = await prisma.theoryLogEntry.findMany({
    where: { studentId: Number(studentId) },
    include: INCLUIR,
    orderBy: { date: 'desc' },
  });
  res.json(registros);
});

router.post('/', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS', 'INSTRUCTOR'), async (req, res) => {
  const { studentId, theoryTopicId, hours, date, notes } = req.body;
  if (!studentId || !theoryTopicId || !hours || !date) {
    return res.status(400).json({ error: 'Faltan datos (alumno, tema, horas y fecha)' });
  }

  const [registro] = await prisma.$transaction([
    prisma.theoryLogEntry.create({
      data: {
        studentId: Number(studentId),
        theoryTopicId: Number(theoryTopicId),
        hours: Number(hours),
        date: new Date(date),
        notes: notes || null,
        createdById: req.user.id,
      },
      include: INCLUIR,
    }),
    prisma.student.update({
      where: { id: Number(studentId) },
      data: { groundCourseHours: { increment: Number(hours) } },
    }),
  ]);

  res.status(201).json(registro);
});

router.delete('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS', 'INSTRUCTOR'), async (req, res) => {
  const id = Number(req.params.id);
  const registro = await prisma.theoryLogEntry.findUnique({ where: { id } });
  if (!registro) return res.status(404).json({ error: 'No encontrado' });

  await prisma.$transaction([
    prisma.theoryLogEntry.delete({ where: { id } }),
    prisma.student.update({
      where: { id: registro.studentId },
      data: { groundCourseHours: { decrement: registro.hours } },
    }),
  ]);

  res.json({ ok: true });
});

module.exports = router;
