const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/courses -> cualquier usuario logueado ve la lista (para el selector de alumnos)
router.get('/', requireAuth, async (req, res) => {
  const cursos = await prisma.course.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { students: true } } },
  });
  res.json(cursos);
});

// POST /api/courses -> solo Admin agrega cursos nuevos
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre del curso es obligatorio' });
  const curso = await prisma.course.create({ data: { name: name.trim() } });
  res.status(201).json(curso);
});

// DELETE /api/courses/:id -> solo Admin
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.student.updateMany({ where: { courseId: id }, data: { courseId: null } });
  await prisma.course.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
