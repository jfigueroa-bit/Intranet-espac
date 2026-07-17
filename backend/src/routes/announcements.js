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

const INCLUIR_TODO = {
  author: { select: AUTOR_INFO },
  likes: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, firstName: true, lastName: true, cargo: true } } },
  },
};

// GET /api/announcements -> todos ven todos los anuncios, primero los fijados ("pinned")
router.get('/', requireAuth, async (req, res) => {
  const anuncios = await prisma.announcement.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    include: INCLUIR_TODO,
  });
  res.json(anuncios);
});

// POST /api/announcements -> cualquier usuario logueado puede publicar un anuncio (con imagen opcional)
router.post('/', requireAuth, async (req, res) => {
  const { title, content, imageData } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'El título y el contenido son obligatorios' });
  }

  const anuncio = await prisma.announcement.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      imageData: imageData || null,
      authorId: req.user.id,
    },
    include: INCLUIR_TODO,
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
    include: INCLUIR_TODO,
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

// POST /api/announcements/:id/like -> da o quita "me gusta" (funciona como interruptor)
router.post('/:id/like', requireAuth, async (req, res) => {
  const announcementId = Number(req.params.id);
  const existente = await prisma.announcementLike.findUnique({
    where: { announcementId_userId: { announcementId, userId: req.user.id } },
  });

  if (existente) {
    await prisma.announcementLike.delete({ where: { id: existente.id } });
  } else {
    await prisma.announcementLike.create({ data: { announcementId, userId: req.user.id } });
  }

  const actualizado = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: INCLUIR_TODO,
  });
  res.json(actualizado);
});

// POST /api/announcements/:id/comments -> cualquier usuario logueado puede comentar
router.post('/:id/comments', requireAuth, async (req, res) => {
  const announcementId = Number(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  }

  await prisma.announcementComment.create({
    data: { announcementId, authorId: req.user.id, content: content.trim() },
  });

  const actualizado = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: INCLUIR_TODO,
  });
  res.json(actualizado);
});

// DELETE /api/announcements/:id/comments/:commentId -> el autor del comentario o Admin (moderación) pueden borrarlo
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  const commentId = Number(req.params.commentId);
  const comentario = await prisma.announcementComment.findUnique({ where: { id: commentId } });
  if (!comentario) return res.status(404).json({ error: 'No encontrado' });
  if (comentario.authorId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'No puedes borrar el comentario de otra persona' });
  }
  await prisma.announcementComment.delete({ where: { id: commentId } });

  const actualizado = await prisma.announcement.findUnique({
    where: { id: Number(req.params.id) },
    include: INCLUIR_TODO,
  });
  res.json(actualizado);
});

module.exports = router;
