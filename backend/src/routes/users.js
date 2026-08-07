const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { generarUsername, generarPasswordTemporal } = require('../utils/username');
const { normalizarHorario } = require('../utils/schedule');
const { notificar } = require('../utils/socket');
const { idsDeVacacionesHoy } = require('../utils/vacationStatus');

const router = express.Router();

const USER_LISTADO = {
  id: true, username: true, firstName: true, lastName: true, email: true,
  role: true, cargo: true, workStatus: true, isActive: true,
  hierarchyOrder: true, managerId: true, vacationDaysTotal: true,
  vacationDaysUsed: true, schedule: true, scheduleNote: true, canViewPayments: true,
  canManageScheduleBlocks: true,
  areas: { include: { area: true } },
};

async function conEstadoDeVacaciones(users) {
  const enVacaciones = await idsDeVacacionesHoy();
  const lista = Array.isArray(users) ? users : [users];
  const resultado = lista.map((u) => (enVacaciones.has(u.id) ? { ...u, workStatus: 'VACACIONES' } : u));
  return Array.isArray(users) ? resultado : resultado[0];
}

router.get('/', requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: USER_LISTADO,
    orderBy: [{ hierarchyOrder: 'asc' }, { firstName: 'asc' }],
  });
  res.json(await conEstadoDeVacaciones(users));
});

router.get('/:id/firma', requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (id !== req.user.id) {
    const esAdmin = req.user.role === 'ADMIN';
    const esRRHH = req.user.role === 'RRHH';
    if (!esAdmin && !esRRHH) {
      const reportes = await prisma.user.count({ where: { managerId: req.user.id, isActive: true } });
      if (reportes === 0) {
        return res.status(403).json({ error: 'No tienes permiso para ver la firma de esa persona' });
      }
    }
  }

  const persona = await prisma.user.findUnique({ where: { id }, select: { signatureData: true } });
  res.json({ signatureData: persona?.signatureData || null });
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { firstName, lastName, email, role, cargo, areaIds = [], managerId } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Nombre, apellido y correo son obligatorios' });
  }

  const existente = await prisma.user.findUnique({ where: { email } });

  if (existente && !existente.isActive) {
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 10);

    await prisma.userArea.deleteMany({ where: { userId: existente.id } });

    const reactivado = await prisma.user.update({
      where: { id: existente.id },
      data: {
        firstName,
        lastName,
        passwordHash,
        role: role || 'EMPLEADO',
        cargo: cargo || null,
        managerId: managerId || null,
        mustChangePassword: true,
        isActive: true,
        areas: {
          create: areaIds.map((areaId) => ({ area: { connect: { id: areaId } } })),
        },
      },
      select: USER_LISTADO,
    });

    return res.status(201).json({ user: reactivado, passwordTemporal });
  }

  if (existente && existente.isActive) {
    return res.status(400).json({ error: 'Ya existe un usuario activo con ese correo institucional' });
  }

  const ultimo = await prisma.user.findFirst({ orderBy: { sequenceNumber: 'desc' } });
  const sequenceNumber = (ultimo?.sequenceNumber || 0) + 1;
  const username = generarUsername(firstName, lastName, sequenceNumber);
  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const nuevo = await prisma.user.create({
    data: {
      sequenceNumber,
      username,
      firstName,
      lastName,
      email,
      passwordHash,
      role: role || 'EMPLEADO',
      cargo: cargo || null,
      managerId: managerId || null,
      mustChangePassword: true,
      areas: {
        create: areaIds.map((areaId) => ({ area: { connect: { id: areaId } } })),
      },
    },
    select: USER_LISTADO,
  });

  res.status(201).json({ user: nuevo, passwordTemporal });
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const {
    firstName, lastName, email, role, cargo, workStatus,
    managerId, hierarchyOrder, areaIds, isActive, canViewPayments, canManageScheduleBlocks,
  } = req.body;

  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (cargo !== undefined) data.cargo = cargo;
  if (workStatus !== undefined) data.workStatus = workStatus;
  if (managerId !== undefined) data.managerId = managerId;
  if (hierarchyOrder !== undefined) data.hierarchyOrder = hierarchyOrder;
  if (isActive !== undefined) data.isActive = isActive;
  if (canViewPayments !== undefined) data.canViewPayments = canViewPayments;
  if (canManageScheduleBlocks !== undefined) data.canManageScheduleBlocks = canManageScheduleBlocks;

  if (Array.isArray(areaIds)) {
    await prisma.userArea.deleteMany({ where: { userId: id } });
    data.areas = { create: areaIds.map((areaId) => ({ area: { connect: { id: areaId } } })) };
  }

  const actualizado = await prisma.user.update({ where: { id }, data, select: USER_LISTADO });
  res.json(actualizado);
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  res.json({ ok: true });
});

router.patch('/:id/estado', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (id !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes cambiar tu propio estado' });
  }
  const { workStatus } = req.body;
  if (!['PRESENCIAL', 'HOME_OFFICE'].includes(workStatus)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }
  const actualizado = await prisma.user.update({
    where: { id }, data: { workStatus }, select: USER_LISTADO,
  });
  res.json(actualizado);
});

router.patch(
  '/:id/horario',
  requireAuth,
  requireRole('ADMIN', 'RRHH'),
  async (req, res) => {
    const id = Number(req.params.id);
    const { schedule, scheduleNote } = req.body;
    const actualizado = await prisma.user.update({
      where: { id },
      data: { schedule: normalizarHorario(schedule), scheduleNote },
      select: USER_LISTADO,
    });

    await notificar({
      userId: id,
      type: 'SISTEMA',
      title: 'Tu horario fue actualizado',
      message: 'Revisa tu horario en tu perfil.',
      link: '/perfil',
    });

    res.json(actualizado);
  }
);

router.patch('/:id/vacaciones', requireAuth, requireRole('ADMIN', 'RRHH'), async (req, res) => {
  const id = Number(req.params.id);
  const { vacationDaysTotal } = req.body;
  if (vacationDaysTotal === undefined || Number(vacationDaysTotal) < 0) {
    return res.status(400).json({ error: 'Indica una cantidad de días válida' });
  }
  const actualizado = await prisma.user.update({
    where: { id },
    data: { vacationDaysTotal: Number(vacationDaysTotal) },
    select: USER_LISTADO,
  });
  res.json(actualizado);
});

router.post('/:id/reset-password', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  res.json({ ok: true, passwordTemporal });
});

module.exports = router;
