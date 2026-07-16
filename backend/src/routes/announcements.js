const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { notificar } = require('../utils/socket');

const router = express.Router();

const AUTOR_INFO = {
  id: true, firstName: true, lastName: true, cargo: true,
  areas: { include: { area: true } },
};

// GET /api/announcements -> todos ven todos los anuncios, primero los fijados ("pinned")
router.get('/', requireAuth, async (req, res) => {
  const anuncios = await prisma.announcement.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    include: { author: { select: AUTOR_INFO } },
  });
  res.json(anuncios);
});

// POST /api/announcements -> cualquier usuario logueado puede publicar un anuncio
router.post('/', requireAuth, async (req, res) => {
  const { title, content } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'El título y el contenido son obligatorios' });
  }

  const anuncio = await prisma.announcement.create({
    data: { title: title.trim(), content: content.trim(), authorId: req.user.id },
    include: { author: { select: AUTOR_INFO } },
  });

  // Avisamos a todos los demás usuarios activos
  const otros = await prisma.user.findMany({
    where: { isActive: true, id: { not: req.user.id } },
    select: { id: true },
  });
  await Promise.all(
    otros.map((u) =>
      notificar({
        userId: u.id,
        type: 'ANUNCIO',
        title: 'Nuevo anuncio',
        message: `${anuncio.author.firstName} publicó: "${anuncio.title}"`,
        link: '/anuncios',
      })
    )
  );

  res.status(201).json(anuncio);
});

// PATCH /api/announcements/:id/fijar -> solo Admin puede fijar/desfijar un anuncio arriba de todo
router.patch('/:id/fijar', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const actual = await prisma.announcement.findUnique({ where: { id } });
  if (!actual) return res.status(404).json({ error: 'No encontrado' });

  const actualizado = await prisma.announcement.update({
    where: { id },
    data: { pinned: !actual.pinned },
    include: { author: { select: AUTOR_INFO } },
  });
  res.json(actualizado);
});

// DELETE /api/announcements/:id -> el autor o Admin pueden borrar un anuncio
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const anuncio = await prisma.announcement.findUnique({ where: { id } });
  if (!anuncio) return res.status(404).json({ error: 'No encontrado' });
  if (anuncio.authorId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'No puedes borrar el anuncio de otra persona' });
  }
  await prisma.announcement.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
