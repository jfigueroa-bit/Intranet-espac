const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { notificar } = require('../utils/socket');
const { fechaSoloDia } = require('../utils/vacationStatus');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true, cargo: true };

const INCLUIR = {
  user: { select: PERSONA_INFO },
  decidedBy: { select: PERSONA_INFO },
};

function diasEntre(inicio, fin) {
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((fin.getTime() - inicio.getTime()) / msPorDia) + 1;
}

// GET /api/vacations -> mis propias solicitudes
router.get('/', requireAuth, async (req, res) => {
  const solicitudes = await prisma.vacationRequest.findMany({
    where: { userId: req.user.id },
    include: INCLUIR,
    orderBy: { createdAt: 'desc' },
  });
  res.json(solicitudes);
});

// GET /api/vacations/todas -> Admin, Gerencia y RRHH ven las solicitudes de todos
router.get('/todas', requireAuth, requireRole('ADMIN', 'GERENCIA', 'RRHH'), async (req, res) => {
  const { status } = req.query;
  const solicitudes = await prisma.vacationRequest.findMany({
    where: status ? { status } : {},
    include: INCLUIR,
    orderBy: { createdAt: 'desc' },
  });
  res.json(solicitudes);
});

// POST /api/vacations -> cualquier usuario solicita sus vacaciones
router.post('/', requireAuth, async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Faltan las fechas de inicio y fin' });
  }

  const inicio = fechaSoloDia(startDate);
  const fin = fechaSoloDia(endDate);
  if (fin < inicio) {
    return res.status(400).json({ error: 'La fecha final no puede ser antes que la inicial' });
  }
  const dias = diasEntre(inicio, fin);

  const yo = await prisma.user.findUnique({ where: { id: req.user.id } });
  const disponibles = yo.vacationDaysTotal - yo.vacationDaysUsed;
  if (dias > disponibles) {
    return res.status(400).json({ error: `Solo te quedan ${disponibles} día(s) disponibles, y estás pidiendo ${dias}` });
  }

  const solicitud = await prisma.vacationRequest.create({
    data: { userId: req.user.id, startDate: inicio, endDate: fin, days: dias, reason: reason || null },
    include: INCLUIR,
  });

  const aprobadores = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'GERENCIA', 'RRHH'] }, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    aprobadores.map((a) =>
      notificar({
        userId: a.id,
        type: 'VACACIONES',
        title: 'Nueva solicitud de vacaciones',
        message: `${solicitud.user.firstName} ${solicitud.user.lastName} solicitó ${dias} día(s).`,
        link: '/vacaciones',
      })
    )
  );

  res.status(201).json(solicitud);
});

// PATCH /api/vacations/:id/decidir -> Admin, Gerencia y RRHH aprueban o rechazan
router.patch('/:id/decidir', requireAuth, requireRole('ADMIN', 'GERENCIA', 'RRHH'), async (req, res) => {
  const id = Number(req.params.id);
  const { decision, decisionNote } = req.body;
  if (!['APROBADA', 'RECHAZADA'].includes(decision)) {
    return res.status(400).json({ error: 'Decisión no válida' });
  }

  const solicitud = await prisma.vacationRequest.findUnique({ where: { id }, include: INCLUIR });
  if (!solicitud) return res.status(404).json({ error: 'No encontrada' });
  if (solicitud.status !== 'PENDIENTE') {
    return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });
  }

  if (decision === 'APROBADA') {
    const usuario = await prisma.user.findUnique({ where: { id: solicitud.userId } });
    const disponibles = usuario.vacationDaysTotal - usuario.vacationDaysUsed;
    if (solicitud.days > disponibles) {
      return res.status(400).json({ error: `Ya no le alcanzan los días (le quedan ${disponibles})` });
    }
    await prisma.user.update({
      where: { id: solicitud.userId },
      data: { vacationDaysUsed: { increment: solicitud.days } },
    });
  }

  const actualizada = await prisma.vacationRequest.update({
    where: { id },
    data: { status: decision, decidedById: req.user.id, decidedAt: new Date(), decisionNote: decisionNote || null },
    include: INCLUIR,
  });

  await notificar({
    userId: solicitud.userId,
    type: 'VACACIONES',
    title: decision === 'APROBADA' ? 'Vacaciones aprobadas' : 'Vacaciones rechazadas',
    message: decision === 'APROBADA'
      ? `Tu solicitud de ${solicitud.days} día(s) fue aprobada.`
      : `Tu solicitud de ${solicitud.days} día(s) fue rechazada.${decisionNote ? ` Motivo: ${decisionNote}` : ''}`,
    link: '/vacaciones',
  });

  res.json(actualizada);
});

module.exports = router;
