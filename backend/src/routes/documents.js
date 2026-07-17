const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireGestorDocumentos } = require('../middleware/documentPermissions');

const router = express.Router();

const AUTOR_INFO = { id: true, firstName: true, lastName: true, cargo: true, managerId: true };

const INCLUIR = {
  documentType: { include: { permissions: true } },
  uploadedBy: { select: AUTOR_INFO },
  owner: { select: AUTOR_INFO },
};

// Quita el archivo pesado (fileData) de la respuesta de listado, para que cargue rápido.
// El archivo completo solo se manda cuando se pide descargar/ver un documento puntual.
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

// ¿target es reporte directo de jefeId?
async function esReporteDirecto(jefeId, targetId) {
  const persona = await prisma.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
  return persona?.managerId === jefeId;
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
      const esSuJefe = await esReporteDirecto(req.user.id, idObjetivo);
      if (!esSuJefe) {
        return res.status(403).json({ error: 'No puedes ver los documentos personales de esa persona' });
      }
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
      const esSuJefe = await esReporteDirecto(req.user.id, doc.ownerId);
      if (!esSuJefe) return res.status(403).json({ error: 'No tienes permiso para ver este documento' });
    }
  } else {
    const misAreaIds = esAdmin ? [] : await areasDelUsuario(req.user.id);
    if (!puedeVerTipo(doc.documentType, misAreaIds, esAdmin)) {
      return res.status(403).json({ error: 'No tienes permiso para ver este documento' });
    }
  }

  res.json({ fileName: doc.fileName, mimeType: doc.mimeType, fileData: doc.fileData });
});

// POST /api/documents -> subir un documento nuevo (o uno generado desde un formulario/plantilla)
// GENERAL: Admin, RRHH, o cualquier jefe de área.
// PERSONAL: Admin y RRHH a cualquiera; un jefe de área SOLO a su gente (sus reportes directos).
router.post('/', requireAuth, requireGestorDocumentos, async (req, res) => {
  const { title, fileName, mimeType, fileData, scope, documentTypeId, ownerId } = req.body;
  if (!title?.trim() || !fileName || !fileData) {
    return res.status(400).json({ error: 'Faltan datos del documento' });
  }
  if (scope === 'PERSONAL' && !ownerId) {
    return res.status(400).json({ error: 'Debes indicar de quién es este documento personal' });
  }

  if (scope === 'PERSONAL' && req.esJefeDeArea) {
    const esSuGente = await esReporteDirecto(req.user.id, Number(ownerId));
    if (!esSuGente) {
      return res.status(403).json({ error: 'Solo puedes subir documentos personales a la gente que te reporta directamente' });
    }
  }

  const doc = await prisma.document.create({
    data: {
      title: title.trim(),
      fileName,
      mimeType: mimeType || 'application/octet-stream',
      fileData,
      scope: scope === 'PERSONAL' ? 'PERSONAL' : 'GENERAL',
      documentTypeId: documentTypeId ? Number(documentTypeId) : null,
      ownerId: scope === 'PERSONAL' ? Number(ownerId) : null,
      uploadedById: req.user.id,
    },
    include: INCLUIR,
  });

  res.status(201).json(sinArchivo(doc));
});

// DELETE /api/documents/:id -> Admin siempre puede; cualquier otra persona solo lo que subió ella misma
router.delete('/:id', requireAuth, async (req, res) => {
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
