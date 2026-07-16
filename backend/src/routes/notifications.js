const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications -> las últimas 50 notificaciones del usuario logueado
router.get('/', requireAuth, async (req, res) => {
  const notificaciones = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notificaciones);
});

// PATCH /api/notifications/:id/leer
router.patch('/:id/leer', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const noti = await prisma.notification.findUnique({ where: { id } });
  if (!noti || noti.userId !== req.user.id) {
    return res.status(404).json({ error: 'No encontrada' });
  }
  const actualizada = await prisma.notification.update({
    where: { id }, data: { read: true },
  });
  res.json(actualizada);
});

// PATCH /api/notifications/leer-todas
router.patch('/leer-todas', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

module.exports = router;
