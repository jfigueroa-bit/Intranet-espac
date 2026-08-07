const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const INCLUIR = {
  course: true,
  _count: { select: { students: true } },
};

// GET /api/promotions -> cualquier usuario logueado (para selectores)
// GET /api/promotions?courseId=3 -> solo las de ese curso
router.get('/', requireAuth, async (req, res) => {
  const { courseId } = req.query;
  const promociones = await prisma.promotion.findMany({
    where: courseId ? { courseId: Number(courseId) } : {},
    include: INCLUIR,
    orderBy: [{ courseId: 'asc' }, { name: 'asc' }],
  });
  res.json(promociones);
});

// POST /api/promotions -> igual permiso que matricular alumnos
router.post('/', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const { name, courseId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre de la promoción es obligatorio' });
  if (!courseId) return res.status(400).json({ error: 'Elige a qué curso pertenece esta promoción' });

  const promocion = await prisma.promotion.create({
    data: { name: name.trim(), courseId: Number(courseId) },
    include: INCLUIR,
  });
  res.status(201).json(promocion);
});

// PATCH /api/promotions/:id
router.patch('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const id = Number(req.params.id);
  const { name, courseId } = req.body;

  const data = {};
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
    data.name = name.trim();
  }
  if (courseId !== undefined) data.courseId = Number(courseId);

  const actualizada = await prisma.promotion.update({ where: { id }, data, include: INCLUIR });
  res.json(actualizada);
});

// DELETE /api/promotions/:id -> los alumnos que la tenían quedan sin promoción asignada
router.delete('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.student.updateMany({ where: { promotionId: id }, data: { promotionId: null } });
  await prisma.promotion.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
