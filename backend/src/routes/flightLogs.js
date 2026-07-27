const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true };
const INCLUIR = {
  aircraftType: true,
  createdBy: { select: PERSONA_INFO },
};

// GET /api/flight-logs?studentId=123 -> historial de vuelos de un alumno
router.get('/', requireAuth, async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Falta indicar el alumno' });

  const registros = await prisma.flightLogEntry.findMany({
    where: { studentId: Number(studentId) },
    include: INCLUIR,
    orderBy: { date: 'desc' },
  });
  res.json(registros);
});

// POST /api/flight-logs -> registra un vuelo nuevo y suma las horas al total del alumno
router.post('/', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS', 'INSTRUCTOR'), async (req, res) => {
  const { studentId, aircraftTypeId, hours, date, notes } = req.body;
  if (!studentId || !aircraftTypeId || !hours || !date) {
    return res.status(400).json({ error: 'Faltan datos (alumno, tipo de avión, horas y fecha)' });
  }

  const [registro] = await prisma.$transaction([
    prisma.flightLogEntry.create({
      data: {
        studentId: Number(studentId),
        aircraftTypeId: Number(aircraftTypeId),
        hours: Number(hours),
        date: new Date(date),
        notes: notes || null,
        createdById: req.user.id,
      },
      include: INCLUIR,
    }),
    prisma.student.update({
      where: { id: Number(studentId) },
      data: { flightHours: { increment: Number(hours) } },
    }),
  ]);

  res.status(201).json(registro);
});

// DELETE /api/flight-logs/:id -> elimina un registro y resta esas horas del total
router.delete('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS', 'INSTRUCTOR'), async (req, res) => {
  const id = Number(req.params.id);
  const registro = await prisma.flightLogEntry.findUnique({ where: { id } });
  if (!registro) return res.status(404).json({ error: 'No encontrado' });

  await prisma.$transaction([
    prisma.flightLogEntry.delete({ where: { id } }),
    prisma.student.update({
      where: { id: registro.studentId },
      data: { flightHours: { decrement: registro.hours } },
    }),
  ]);

  res.json({ ok: true });
});

module.exports = router;
