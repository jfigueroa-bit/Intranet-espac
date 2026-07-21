const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { notificar } = require('../utils/socket');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true, cargo: true };
const INCLUIR = {
  requester: { select: PERSONA_INFO },
  assignee: { select: PERSONA_INFO },
};

const ESTADOS_VALIDOS = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'RECHAZADA'];
const ESTADO_LABEL = { PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', COMPLETADA: 'Completada', RECHAZADA: 'Rechazada' };

// GET /api/requests?rol=mias -> las que yo creé
// GET /api/requests?rol=meSolicitan -> las que me piden a mí (por defecto)
router.get('/', requireAuth, async (req, res) => {
  const { rol } = req.query;
  const where = rol === 'mias' ? { requesterId: req.user.id } : { assigneeId: req.user.id };

  const solicitudes = await prisma.request.findMany({
    where,
    include: INCLUIR,
    orderBy: { createdAt: 'desc' },
  });
  res.json(solicitudes);
});

// POST /api/requests -> le pido algo a alguien
router.post('/', requireAuth, async (req, res) => {
  const { title, description, assigneeId, fileData, fileName, mimeType } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'El asunto es obligatorio' });
  const assigneeIdNum = Number(assigneeId);
  if (!assigneeIdNum) return res.status(400).json({ error: 'Elige a quién va dirigida la solicitud' });
  if (assigneeIdNum === req.user.id) return res.status(400).json({ error: 'No puedes hacerte una solicitud a ti mismo' });

  const solicitud = await prisma.request.create({
    data: {
      title: title.trim(),
      description: description || null,
      requesterId: req.user.id,
      assigneeId: assigneeIdNum,
      fileData: fileData || null,
      fileName: fileName || null,
      mimeType: mimeType || null,
    },
    include: INCLUIR,
  });

  await notificar({
    userId: assigneeIdNum,
    type: 'SOLICITUD',
    title: 'Nueva solicitud',
    message: `${solicitud.requester.firstName} ${solicitud.requester.lastName} te pidió: "${solicitud.title}"`,
    link: '/solicitudes',
  });

  res.status(201).json(solicitud);
});

// PATCH /api/requests/:id/estado -> solo quien la recibió (o Admin) puede cambiar el estado
router.patch('/:id/estado', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status, responseNote } = req.body;
  if (!ESTADOS_VALIDOS.includes(status)) return res.status(400).json({ error: 'Estado no válido' });

  const solicitud = await prisma.request.findUnique({ where: { id }, include: INCLUIR });
  if (!solicitud) return res.status(404).json({ error: 'No encontrada' });
  if (solicitud.assigneeId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo la persona a la que se la pidieron puede cambiar su estado' });
  }

  const esFinal = ['COMPLETADA', 'RECHAZADA'].includes(status);

  const actualizada = await prisma.request.update({
    where: { id },
    data: { status, responseNote: responseNote || null, resolvedAt: esFinal ? new Date() : null },
    include: INCLUIR,
  });

  await notificar({
    userId: solicitud.requesterId,
    type: 'SOLICITUD',
    title: `Tu solicitud está ${ESTADO_LABEL[status].toLowerCase()}`,
    message: `"${solicitud.title}"${responseNote ? ` — ${responseNote}` : ''}`,
    link: '/solicitudes',
  });

  res.json(actualizada);
});

// DELETE /api/requests/:id -> quien la creó, o Admin, la puede cancelar/eliminar
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const solicitud = await prisma.request.findUnique({ where: { id } });
  if (!solicitud) return res.status(404).json({ error: 'No encontrada' });
  if (solicitud.requesterId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo quien la creó puede eliminarla' });
  }
  await prisma.request.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
