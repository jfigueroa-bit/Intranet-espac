const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const INCLUIR = { permissions: { include: { area: true } } };

// GET /api/document-types -> cualquier usuario logueado ve los tipos que existen (para elegir al subir/filtrar)
router.get('/', requireAuth, async (req, res) => {
  const tipos = await prisma.documentType.findMany({
    orderBy: { name: 'asc' },
    include: INCLUIR,
  });
  res.json(tipos);
});

// POST /api/document-types -> solo Admin crea un tipo nuevo (ej: "Contratos")
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const tipo = await prisma.documentType.create({ data: { name: name.trim() }, include: INCLUIR });
  res.status(201).json(tipo);
});

// PATCH /api/document-types/:id/permisos -> solo Admin decide qué áreas pueden ver este tipo
// (si se manda una lista vacía, el tipo queda visible para TODA la empresa)
router.patch('/:id/permisos', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { areaIds = [] } = req.body;

  await prisma.documentTypeAreaPermission.deleteMany({ where: { documentTypeId: id } });
  if (areaIds.length > 0) {
    await prisma.documentTypeAreaPermission.createMany({
      data: areaIds.map((areaId) => ({ documentTypeId: id, areaId })),
    });
  }

  const actualizado = await prisma.documentType.findUnique({ where: { id }, include: INCLUIR });
  res.json(actualizado);
});

// DELETE /api/document-types/:id -> solo Admin
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  await prisma.documentType.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
