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

// POST /api/areas -> Admin crea un tag/área nuevo (ej: "Vuelos", "Simuladores")
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del área es obligatorio' });
  }
  const area = await prisma.area.create({ data: { name: name.trim() } });
  res.status(201).json(area);
});

// DELETE /api/areas/:id -> Admin elimina un área
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  await prisma.area.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
