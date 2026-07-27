const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true };
const INCLUIR = {
  createdBy: { select: PERSONA_INFO },
  paidBy: { select: PERSONA_INFO },
  student: { select: { id: true, code: true, firstName: true, lastName: true } },
};

// Admin y Gerencia siempre pueden; cualquier otra persona necesita el permiso
// individual "canViewPayments", que un Admin le otorga a mano desde Usuarios.
async function requireVerPagos(req, res, next) {
  if (['ADMIN', 'GERENCIA'].includes(req.user.role)) return next();
  const yo = await prisma.user.findUnique({ where: { id: req.user.id }, select: { canViewPayments: true } });
  if (yo?.canViewPayments) return next();
  return res.status(403).json({ error: 'No tienes permiso para ver la información de pagos' });
}

// GET /api/payments?studentId=123 -> cuotas de un alumno
router.get('/', requireAuth, requireVerPagos, async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Falta indicar el alumno' });

  const cuotas = await prisma.payment.findMany({
    where: { studentId: Number(studentId) },
    include: INCLUIR,
    orderBy: { dueDate: 'asc' },
  });
  res.json(cuotas);
});

// GET /api/payments/:id -> una cuota puntual (para armar su boleta en PDF)
router.get('/:id', requireAuth, requireVerPagos, async (req, res) => {
  const id = Number(req.params.id);
  const cuota = await prisma.payment.findUnique({ where: { id }, include: INCLUIR });
  if (!cuota) return res.status(404).json({ error: 'No encontrada' });
  res.json(cuota);
});

// POST /api/payments -> registra una cuota nueva
router.post('/', requireAuth, requireVerPagos, async (req, res) => {
  const { studentId, concept, amount, currency, dueDate, notes } = req.body;
  if (!studentId || !concept?.trim() || !amount || !dueDate) {
    return res.status(400).json({ error: 'Faltan datos de la cuota (alumno, concepto, monto y fecha de vencimiento)' });
  }
  if (currency && !['PEN', 'USD'].includes(currency)) {
    return res.status(400).json({ error: 'Moneda no válida' });
  }

  const cuota = await prisma.payment.create({
    data: {
      studentId: Number(studentId),
      concept: concept.trim(),
      amount: Number(amount),
      currency: currency || 'PEN',
      dueDate: new Date(dueDate),
      notes: notes || null,
      createdById: req.user.id,
    },
    include: INCLUIR,
  });
  res.status(201).json(cuota);
});

// PATCH /api/payments/:id -> editar una cuota, o marcarla como pagada/pendiente
// Al marcarla como pagada, se guarda quién la autorizó (quien hace la acción).
router.patch('/:id', requireAuth, requireVerPagos, async (req, res) => {
  const id = Number(req.params.id);
  const { concept, amount, currency, dueDate, notes, marcarPagada } = req.body;

  if (currency !== undefined && !['PEN', 'USD'].includes(currency)) {
    return res.status(400).json({ error: 'Moneda no válida' });
  }

  const data = {};
  if (concept !== undefined) data.concept = concept;
  if (amount !== undefined) data.amount = Number(amount);
  if (currency !== undefined) data.currency = currency;
  if (dueDate !== undefined) data.dueDate = new Date(dueDate);
  if (notes !== undefined) data.notes = notes || null;
  if (marcarPagada !== undefined) {
    data.paidDate = marcarPagada ? new Date() : null;
    data.paidById = marcarPagada ? req.user.id : null;
  }

  const actualizada = await prisma.payment.update({
    where: { id }, data, include: INCLUIR,
  });
  res.json(actualizada);
});

// DELETE /api/payments/:id -> elimina una cuota
router.delete('/:id', requireAuth, requireVerPagos, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.payment.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
