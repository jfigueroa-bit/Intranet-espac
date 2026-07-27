const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Falta indicar el alumno' });

  const inscripciones = await prisma.studentCourse.findMany({
    where: { studentId: Number(studentId) },
    include: { course: true },
    orderBy: { enrolledAt: 'desc' },
  });
  res.json(inscripciones);
});

router.post('/', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const { studentId, courseId, status } = req.body;
  if (!studentId || !courseId) {
    return res.status(400).json({ error: 'Faltan datos (alumno y curso)' });
  }

  const inscripcion = await prisma.studentCourse.create({
    data: {
      studentId: Number(studentId),
      courseId: Number(courseId),
      status: status || 'EN_CURSO',
    },
    include: { course: true },
  });
  res.status(201).json(inscripcion);
});

router.patch('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!['EN_CURSO', 'COMPLETADO'].includes(status)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }

  const actualizada = await prisma.studentCourse.update({
    where: { id },
    data: { status, completedAt: status === 'COMPLETADO' ? new Date() : null },
    include: { course: true },
  });
  res.json(actualizada);
});

router.delete('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.studentCourse.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
