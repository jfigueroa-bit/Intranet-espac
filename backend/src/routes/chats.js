const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { emitirAUsuario } = require('../utils/socket');
const { sincronizarChatsDeArea } = require('../utils/chatSync');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true, cargo: true };

// GET /api/chats -> mis conversaciones (directas + de área), con el último mensaje
router.get('/', requireAuth, async (req, res) => {
  // Nos auto-sincronizamos primero: así, aunque a alguien le hayan cambiado sus
  // áreas antes de que existiera este módulo, queda al día apenas entra al chat.
  const misAreas = await prisma.userArea.findMany({ where: { userId: req.user.id }, select: { areaId: true } });
  await sincronizarChatsDeArea(req.user.id, misAreas.map((a) => a.areaId));

  const participaciones = await prisma.conversationParticipant.findMany({
    where: { userId: req.user.id },
    include: {
      conversation: {
        include: {
          area: true,
          participants: { include: { user: { select: PERSONA_INFO } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: PERSONA_INFO } } },
        },
      },
    },
  });

  const conversaciones = participaciones.map((p) => {
    const c = p.conversation;
    const otro = c.type === 'DIRECT' ? c.participants.map((x) => x.user).find((u) => u.id !== req.user.id) : null;
    return {
      id: c.id,
      type: c.type,
      area: c.area,
      otherUser: otro,
      lastMessage: c.messages[0] || null,
    };
  });

  conversaciones.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
  });

  res.json(conversaciones);
});

// POST /api/chats/directo -> abre (o encuentra) el chat privado con otra persona
router.post('/directo', requireAuth, async (req, res) => {
  const otroId = Number(req.body.userId);
  if (!otroId || otroId === req.user.id) {
    return res.status(400).json({ error: 'Usuario no válido' });
  }

  const existente = await prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { participants: { some: { userId: req.user.id } } },
        { participants: { some: { userId: otroId } } },
      ],
    },
  });
  if (existente) return res.json({ id: existente.id });

  const nueva = await prisma.conversation.create({
    data: {
      type: 'DIRECT',
      participants: { create: [{ userId: req.user.id }, { userId: otroId }] },
    },
  });
  res.status(201).json({ id: nueva.id });
});

// GET /api/chats/:id/mensajes -> historial (solo si soy participante)
router.get('/:id/mensajes', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const soyParticipante = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: req.user.id } },
  });
  if (!soyParticipante) return res.status(403).json({ error: 'No tienes acceso a este chat' });

  const mensajes = await prisma.chatMessage.findMany({
    where: { conversationId: id },
    include: { sender: { select: PERSONA_INFO } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json(mensajes);
});

// POST /api/chats/:id/mensajes -> mandar un mensaje (texto, con emojis normales, y/o un archivo)
router.post('/:id/mensajes', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { content, fileData, fileName, mimeType } = req.body;
  if (!content?.trim() && !fileData) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  }

  const soyParticipante = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: req.user.id } },
  });
  if (!soyParticipante) return res.status(403).json({ error: 'No tienes acceso a este chat' });

  const mensaje = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      senderId: req.user.id,
      content: content?.trim() || null,
      fileData: fileData || null,
      fileName: fileName || null,
      mimeType: mimeType || null,
    },
    include: { sender: { select: PERSONA_INFO } },
  });

  const participantes = await prisma.conversationParticipant.findMany({ where: { conversationId: id } });
  participantes.forEach((p) => {
    emitirAUsuario(p.userId, 'chat:mensaje', { conversationId: id, mensaje });
  });

  res.status(201).json(mensaje);
});

module.exports = router;
