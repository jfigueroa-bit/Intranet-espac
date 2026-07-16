const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/areas
router.get('/', requireAuth, async (req, res) => {
  const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
  res.json(areas);
});

// POST /api/areas -> Admin crea un tag/área nuevo, con color (ej: "Vuelos", "#2e7d32")
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del área es obligatorio' });
  }
  const area = await prisma.area.create({
    data: { name: name.trim(), color: color || '#1c2b4a' },
  });
  res.status(201).json(area);
});

// PATCH /api/areas/:id -> Admin edita nombre y/o color de un área
router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { name, color } = req.body;
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (color !== undefined) data.color = color;

  const area = await prisma.area.update({ where: { id }, data });
  res.json(area);
});

// DELETE /api/areas/:id -> Admin elimina un área
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  await prisma.area.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
