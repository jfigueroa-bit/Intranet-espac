const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const tipos = await prisma.simulatorType.findMany({ orderBy: { name: 'asc' } });
  res.json(tipos);
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const tipo = await prisma.simulatorType.create({ data: { name: name.trim() } });
  res.status(201).json(tipo);
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.simulatorType.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
