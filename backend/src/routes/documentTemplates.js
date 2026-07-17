const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireGestorDocumentos } = require('../middleware/documentPermissions');

const router = express.Router();

// GET /api/document-templates -> cualquiera que pueda crear documentos ve las plantillas disponibles
router.get('/', requireAuth, requireGestorDocumentos, async (req, res) => {
  const plantillas = await prisma.documentTemplate.findMany({ orderBy: { name: 'asc' } });
  res.json(plantillas);
});

// POST /api/document-templates -> crea una plantilla nueva (Admin, RRHH, o cualquier jefe de área)
router.post('/', requireAuth, requireGestorDocumentos, async (req, res) => {
  const { name, intro, fields = [] } = req.body;
  if (!name?.trim() || !intro?.trim()) {
    return res.status(400).json({ error: 'El nombre y el texto de la plantilla son obligatorios' });
  }
  const plantilla = await prisma.documentTemplate.create({
    data: { name: name.trim(), intro: intro.trim(), fields, createdById: req.user.id },
  });
  res.status(201).json(plantilla);
});

// DELETE /api/document-templates/:id -> quien la creó, o Admin
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const plantilla = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!plantilla) return res.status(404).json({ error: 'No encontrada' });
  if (plantilla.createdById !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'No puedes borrar una plantilla que no creaste tú' });
  }
  await prisma.documentTemplate.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
