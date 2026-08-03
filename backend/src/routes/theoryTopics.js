const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const temas = await prisma.theoryTopic.findMany({ orderBy: { name: 'asc' } });
  res.json(temas);
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const tema = await prisma.theoryTopic.create({ data: { name: name.trim() } });
  res.status(201).json(tema);
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.theoryTopic.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
