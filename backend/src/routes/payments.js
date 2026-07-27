const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CREADOR_INFO = { id: true, firstName: true, lastName: true };

async function requireVerPagos(req, res, next) {
  if (['ADMIN', 'GERENCIA'].includes(req.user.role)) return next();
  const yo = await prisma.user.findUnique({ where: { id: req.user.id }, select: { canViewPayments: true } });
  if (yo?.canViewPayments) return next();
  return res.status(403).json({ error: 'No tienes permiso para ver la información de pagos' });
}

router.get('/', requireAuth, requireVerPagos, async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Falta indicar el alumno' });

  const cuotas = await prisma.payment.findMany({
    where: { studentId: Number(studentId) },
    include: { createdBy: { select: CREADOR_INFO } },
    orderBy: { dueDate: 'asc' },
  });
  res.json(cuotas);
});

router.post('/', requireAuth, requireVerPagos, async (req, res) => {
  const { studentId, concept, amount, dueDate, notes } = req.body;
  if (!studentId || !concept?.trim() || !amount || !dueDate) {
    return res.status(400).json({ error: 'Faltan datos de la cuota (alumno, concepto, monto y fecha de vencimiento)' });
  }

  const cuota = await prisma.payment.create({
    data: {
      studentId: Number(studentId),
      concept: concept.trim(),
      amount: Number(amount),
      dueDate: new Date(dueDate),
      notes: notes || null,
      createdById: req.user.id,
    },
    include: { createdBy: { select: CREADOR_INFO } },
  });
  res.status(201).json(cuota);
});

router.patch('/:id', requireAuth, requireVerPagos, async (req, res) => {
  const id = Number(req.params.id);
  const { concept, amount, dueDate, notes, marcarPagada } = req.body;

  const data = {};
  if (concept !== undefined) data.concept = concept;
  if (amount !== undefined) data.amount = Number(amount);
  if (dueDate !== undefined) data.dueDate = new Date(dueDate);
  if (notes !== undefined) data.notes = notes || null;
  if (marcarPagada !== undefined) data.paidDate = marcarPagada ? new Date() : null;

  const actualizada = await prisma.payment.update({
    where: { id }, data, include: { createdBy: { select: CREADOR_INFO } },
  });
  res.json(actualizada);
});

router.delete('/:id', requireAuth, requireVerPagos, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.payment.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
