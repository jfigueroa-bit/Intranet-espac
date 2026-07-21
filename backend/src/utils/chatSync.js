const prisma = require('../lib/prisma');

// Crea (si no existía) el chat grupal de un área, y devuelve el id de esa conversación.
async function asegurarConversacionDeArea(areaId) {
  const existente = await prisma.conversation.findUnique({ where: { areaId } });
  if (existente) return existente.id;
  const nueva = await prisma.conversation.create({ data: { type: 'AREA', areaId } });
  return nueva.id;
}

// Hace que alguien esté (y solo esté) en los chats de área que le corresponden
// según sus tags actuales: lo agrega a los que le faltan, y lo quita de los que
// ya no tiene. Se llama cada vez que a alguien se le cambian sus áreas.
async function sincronizarChatsDeArea(userId, areaIds) {
  for (const areaId of areaIds) {
    const conversationId = await asegurarConversacionDeArea(areaId);
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      update: {},
      create: { conversationId, userId },
    });
  }

  const misParticipaciones = await prisma.conversationParticipant.findMany({
    where: { userId, conversation: { type: 'AREA' } },
    include: { conversation: true },
  });
  const idsQueDeberianQuedar = new Set(areaIds);
  const aQuitar = misParticipaciones.filter((p) => !idsQueDeberianQuedar.has(p.conversation.areaId));
  if (aQuitar.length > 0) {
    await prisma.conversationParticipant.deleteMany({ where: { id: { in: aQuitar.map((p) => p.id) } } });
  }
}

module.exports = { asegurarConversacionDeArea, sincronizarChatsDeArea };
