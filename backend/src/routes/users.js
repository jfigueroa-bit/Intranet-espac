const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { generarUsername, generarPasswordTemporal } = require('../utils/username');
const { normalizarHorario } = require('../utils/schedule');
const { notificar } = require('../utils/socket');

const router = express.Router();

const USER_LISTADO = {
  id: true, username: true, firstName: true, lastName: true, email: true,
  role: true, cargo: true, workStatus: true, isActive: true,
  hierarchyOrder: true, managerId: true, vacationDaysTotal: true,
  vacationDaysUsed: true, schedule: true, scheduleNote: true,
  areas: { include: { area: true } },
};

// GET /api/users  -> directorio de la compañía (cualquier usuario logueado puede ver)
router.get('/', requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: USER_LISTADO,
    orderBy: [{ hierarchyOrder: 'asc' }, { firstName: 'asc' }],
  });
  res.json(users);
});

// GET /api/users/:id/firma -> trae la firma digital guardada de alguien, para incrustarla
// al generar un documento. Solo quien puede crear documentos (Admin, RRHH, o un jefe de
// área) puede pedir la firma de otra persona; cualquiera puede pedir la suya propia.
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

// POST /api/users  -> Admin crea un usuario nuevo (username y contraseña se generan solos)
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { firstName, lastName, email, role, cargo, areaIds = [], managerId } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Nombre, apellido y correo son obligatorios' });
  }

  const existente = await prisma.user.findUnique({ where: { email } });

  // Si el correo pertenece a alguien que fue "eliminado" (desactivado) antes,
  // reactivamos esa misma cuenta en vez de fallar por correo duplicado.
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

  // Devolvemos la contraseña temporal UNA sola vez, para que el admin se la comparta al usuario
  res.status(201).json({ user: nuevo, passwordTemporal });
});

// PATCH /api/users/:id  -> Admin edita cualquier dato del usuario (nombre, correo, cargo,
// rol, áreas/tags -uno o varios-, jefe directo, orden jerárquico, estado activo)
router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const {
    firstName, lastName, email, role, cargo, workStatus,
    managerId, hierarchyOrder, areaIds, isActive,
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

  if (Array.isArray(areaIds)) {
    await prisma.userArea.deleteMany({ where: { userId: id } });
    data.areas = { create: areaIds.map((areaId) => ({ area: { connect: { id: areaId } } })) };
  }

  const actualizado = await prisma.user.update({ where: { id }, data, select: USER_LISTADO });
  res.json(actualizado);
});

// DELETE /api/users/:id -> Admin "elimina" un usuario. No se borra de la base de datos
// (para no perder su historial de vacaciones, solicitudes, etc.), simplemente se
// desactiva: deja de aparecer en la Compañía y ya no puede iniciar sesión.
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  res.json({ ok: true });
});

// PATCH /api/users/:id/estado -> cualquier usuario cambia SU PROPIO estado (presencial/home office)
// (vacaciones lo pone el sistema automáticamente en la Fase de Vacaciones, no a mano)
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

// PATCH /api/users/:id/horario -> SOLO Admin o RRHH pueden subir el horario de alguien
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

// POST /api/users/:id/reset-password -> Admin restablece la contraseña de alguien
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
