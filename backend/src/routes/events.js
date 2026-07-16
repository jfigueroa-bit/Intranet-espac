const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const AUTOR_INFO = { id: true, firstName: true, lastName: true };

// GET /api/events -> todos los eventos del calendario (cualquier usuario los ve)
router.get('/', requireAuth, async (req, res) => {
  const eventos = await prisma.calendarEvent.findMany({
    orderBy: { date: 'asc' },
    include: { createdBy: { select: AUTOR_INFO } },
  });
  res.json(eventos);
});

// POST /api/events -> cualquier usuario logueado puede agregar una fecha importante
router.post('/', requireAuth, async (req, res) => {
  const { title, description, date, color } = req.body;
  if (!title?.trim() || !date) {
    return res.status(400).json({ error: 'El título y la fecha son obligatorios' });
  }

  const evento = await prisma.calendarEvent.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      date: new Date(date),
      color: color || '#1c2b4a',
      createdById: req.user.id,
    },
    include: { createdBy: { select: AUTOR_INFO } },
  });

  res.status(201).json(evento);
});

// DELETE /api/events/:id -> el autor o Admin pueden borrar un evento
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const evento = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!evento) return res.status(404).json({ error: 'No encontrado' });
  if (evento.createdById !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'No puedes borrar un evento que no creaste tú' });
  }
  await prisma.calendarEvent.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
