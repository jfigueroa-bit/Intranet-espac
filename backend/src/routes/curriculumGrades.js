const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true };

// GET /api/curriculum-grades?studentCourseId=123 -> la currícula (notas por tema) de esa inscripción
router.get('/', requireAuth, async (req, res) => {
  const { studentCourseId } = req.query;
  if (!studentCourseId) return res.status(400).json({ error: 'Falta indicar la inscripción' });

  const notas = await prisma.curriculumGrade.findMany({
    where: { studentCourseId: Number(studentCourseId) },
    include: {
      theoryTopic: { select: { id: true, name: true } },
      updatedBy: { select: PERSONA_INFO },
    },
    orderBy: { theoryTopic: { name: 'asc' } },
  });
  res.json(notas);
});

// PATCH /api/curriculum-grades/:id -> actualiza la nota de un tema puntual
router.patch('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'INSTRUCTOR'), async (req, res) => {
  const id = Number(req.params.id);
  const { grade } = req.body;

  const actualizada = await prisma.curriculumGrade.update({
    where: { id },
    data: {
      grade: grade === '' || grade === null || grade === undefined ? null : Number(grade),
      updatedById: req.user.id,
    },
    include: {
      theoryTopic: { select: { id: true, name: true } },
      updatedBy: { select: PERSONA_INFO },
    },
  });
  res.json(actualizada);
});

module.exports = router;
