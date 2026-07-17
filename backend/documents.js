const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const AUTOR_INFO = { id: true, firstName: true, lastName: true, cargo: true };

const INCLUIR = {
  documentType: { include: { permissions: true } },
  uploadedBy: { select: AUTOR_INFO },
  owner: { select: AUTOR_INFO },
};

// Quita el archivo pesado (fileData) de la respuesta de listado, para que cargue rápido.
// El archivo completo solo se manda cuando se pide descargar un documento puntual.
function sinArchivo(doc) {
  const { fileData, ...resto } = doc;
  return resto;
}

async function areasDelUsuario(userId) {
  const relaciones = await prisma.userArea.findMany({ where: { userId }, select: { areaId: true } });
  return relaciones.map((r) => r.areaId);
}

function puedeVerTipo(documentType, misAreaIds, esAdmin) {
  if (esAdmin) return true;
  if (!documentType) return true; // sin tipo asignado = documento abierto a todos
  if (documentType.permissions.length === 0) return true; // sin restricciones = todos pueden verlo
  return documentType.permissions.some((p) => misAreaIds.includes(p.areaId));
}

// GET /api/documents?scope=GENERAL
// GET /api/documents?scope=PERSONAL&userId=5  (si no se manda userId, son los propios)
router.get('/', requireAuth, async (req, res) => {
  const { scope, userId } = req.query;
  const esAdmin = req.user.role === 'ADMIN';
  const esRRHH = req.user.role === 'RRHH';

  if (scope === 'PERSONAL') {
    const idObjetivo = userId ? Number(userId) : req.user.id;
    if (idObjetivo !== req.user.id && !esAdmin && !esRRHH) {
      return res.status(403).json({ error: 'No puedes ver los documentos personales de otra persona' });
    }
    const documentos = await prisma.document.findMany({
      where: { scope: 'PERSONAL', ownerId: idObjetivo },
      orderBy: { createdAt: 'desc' },
      include: INCLUIR,
    });
    return res.json(documentos.map(sinArchivo));
  }

  // scope GENERAL (o sin especificar)
  const documentos = await prisma.document.findMany({
    where: { scope: 'GENERAL' },
    orderBy: { createdAt: 'desc' },
    include: INCLUIR,
  });
  const misAreaIds = esAdmin ? [] : await areasDelUsuario(req.user.id);
  const visibles = documentos.filter((d) => puedeVerTipo(d.documentType, misAreaIds, esAdmin));
  res.json(visibles.map(sinArchivo));
});

// GET /api/documents/:id/descargar -> trae el archivo completo (con el mismo control de permisos)
router.get('/:id/descargar', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id }, include: INCLUIR });
  if (!doc) return res.status(404).json({ error: 'No encontrado' });

  const esAdmin = req.user.role === 'ADMIN';
  const esRRHH = req.user.role === 'RRHH';

  if (doc.scope === 'PERSONAL') {
    if (doc.ownerId !== req.user.id && !esAdmin && !esRRHH) {
      return res.status(403).json({ error: 'No tienes permiso para ver este documento' });
    }
  } else {
    const misAreaIds = esAdmin ? [] : await areasDelUsuario(req.user.id);
    if (!puedeVerTipo(doc.documentType, misAreaIds, esAdmin)) {
      return res.status(403).json({ error: 'No tienes permiso para ver este documento' });
    }
  }

  res.json({ fileName: doc.fileName, mimeType: doc.mimeType, fileData: doc.fileData });
});

// POST /api/documents -> subir un documento nuevo
// GENERAL: solo Admin o RRHH. PERSONAL: solo Admin o RRHH, indicando ownerId (para quién es).
router.post('/', requireAuth, requireRole('ADMIN', 'RRHH'), async (req, res) => {
  const { title, fileName, mimeType, fileData, scope, documentTypeId, ownerId } = req.body;
  if (!title?.trim() || !fileName || !fileData) {
    return res.status(400).json({ error: 'Faltan datos del documento' });
  }
  if (scope === 'PERSONAL' && !ownerId) {
    return res.status(400).json({ error: 'Debes indicar de quién es este documento personal' });
  }

  const doc = await prisma.document.create({
    data: {
      title: title.trim(),
      fileName,
      mimeType: mimeType || 'application/octet-stream',
      fileData,
      scope: scope === 'PERSONAL' ? 'PERSONAL' : 'GENERAL',
      documentTypeId: documentTypeId || null,
      ownerId: scope === 'PERSONAL' ? Number(ownerId) : null,
      uploadedById: req.user.id,
    },
    include: INCLUIR,
  });

  res.status(201).json(sinArchivo(doc));
});

// DELETE /api/documents/:id -> Admin siempre puede; RRHH solo lo que subió ella misma
router.delete('/:id', requireAuth, requireRole('ADMIN', 'RRHH'), async (req, res) => {
  const id = Number(req.params.id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'ADMIN' && doc.uploadedById !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes borrar documentos que tú subiste' });
  }
  await prisma.document.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
