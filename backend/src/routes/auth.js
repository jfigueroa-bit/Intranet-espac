const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const valido = await bcrypt.compare(password, user.passwordHash);
  if (!valido) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      cargo: user.cargo,
    },
  });
});

// POST /api/auth/change-password  (el propio usuario cambia su contraseña)
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  // Si ya cambió su contraseña antes, le pedimos la actual para confirmar.
  // Si es su primer cambio obligatorio (mustChangePassword), no la pedimos.
  if (!user.mustChangePassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Debes indicar tu contraseña actual' });
    }
    const valido = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valido) {
      return res.status(401).json({ error: 'Tu contraseña actual no es correcta' });
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, username: true, firstName: true, lastName: true, email: true,
      role: true, cargo: true, scheduleUrl: true, scheduleNote: true,
      workStatus: true, mustChangePassword: true, vacationDaysTotal: true,
      vacationDaysUsed: true,
      areas: { include: { area: true } },
    },
  });
  res.json(user);
});

module.exports = router;
