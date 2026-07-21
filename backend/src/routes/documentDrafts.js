const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireGestorDocumentos } = require('../middleware/documentPermissions');
const { notificar } = require('../utils/socket');
const { construirDocumentoHTML, reemplazarTokens } = require('../utils/documentoHTML');

const router = express.Router();

const PERSONA_INFO = { id: true, firstName: true, lastName: true, cargo: true };

const INCLUIR = {
  template: true,
  documentType: true,
  owner: { select: PERSONA_INFO },
  createdBy: { select: PERSONA_INFO },
  signers: { include: { user: { select: PERSONA_INFO } }, orderBy: { order: 'asc' } },
};

async function esReporteDirecto(jefeId, targetId) {
  const persona = await prisma.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
  return persona?.managerId === jefeId;
}

// POST /api/document-drafts -> crea un documento "en camino" y notifica a quienes deben firmarlo
router.post('/', requireAuth, requireGestorDocumentos, async (req, res) => {
  const { templateId, ownerId, firmante2Id, fecha, values = {}, documentTypeId, imageData } = req.body;
  if (!templateId || !ownerId || !fecha) {
    return res.status(400).json({ error: 'Faltan datos para generar el documento' });
  }

  if (req.esJefeDeArea) {
    const esSuGente = await esReporteDirecto(req.user.id, Number(ownerId));
    if (!esSuGente) {
      return res.status(403).json({ error: 'Solo puedes generar documentos para la gente que te reporta directamente' });
    }
  }

  const plantilla = await prisma.documentTemplate.findUnique({ where: { id: Number(templateId) } });
  if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

  const draft = await prisma.documentDraft.create({
    data: {
      templateId: Number(templateId),
      title: plantilla.name,
      values,
      fecha: new Date(fecha),
      imageData: imageData || null,
      documentTypeId: documentTypeId ? Number(documentTypeId) : null,
      ownerId: Number(ownerId),
      createdById: req.user.id,
      signers: {
        create: [
          { userId: Number(ownerId), order: 1 },
          ...(firmante2Id ? [{ userId: Number(firmante2Id), order: 2 }] : []),
        ],
      },
    },
    include: INCLUIR,
  });

  await Promise.all(
    draft.signers.map((s) =>
      notificar({
        userId: s.user.id,
        type: 'FIRMA',
        title: 'Tienes un documento para firmar',
        message: `"${draft.title}" necesita tu firma.`,
        link: '/documentos',
      })
    )
  );

  res.status(201).json(draft);
});

// GET /api/document-drafts?rol=pendientes -> documentos que YO todavía tengo que firmar
// GET /api/document-drafts?rol=creados -> documentos que YO generé, para ver su estado
router.get('/', requireAuth, async (req, res) => {
  const { rol } = req.query;

  if (rol === 'creados') {
    const drafts = await prisma.documentDraft.findMany({
      where: { createdById: req.user.id },
      include: INCLUIR,
      orderBy: { createdAt: 'desc' },
    });
    return res.json(drafts);
  }

  // por defecto: pendientes de mi firma
  const drafts = await prisma.documentDraft.findMany({
    where: {
      status: 'PENDIENTE',
      signers: { some: { userId: req.user.id, signedAt: null } },
    },
    include: INCLUIR,
    orderBy: { createdAt: 'desc' },
  });
  res.json(drafts);
});

// GET /api/document-drafts/:id -> ver el detalle de un borrador (para previsualizar antes de firmar)
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const draft = await prisma.documentDraft.findUnique({ where: { id }, include: INCLUIR });
  if (!draft) return res.status(404).json({ error: 'No encontrado' });

  const involucrado =
    draft.createdById === req.user.id ||
    draft.signers.some((s) => s.userId === req.user.id) ||
    req.user.role === 'ADMIN';
  if (!involucrado) return res.status(403).json({ error: 'No tienes permiso para ver este documento' });

  res.json(draft);
});

// POST /api/document-drafts/:id/firmar -> firma con la firma guardada del perfil, o con una indicada
router.post('/:id/firmar', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { signature } = req.body;

  const draft = await prisma.documentDraft.findUnique({ where: { id }, include: INCLUIR });
  if (!draft) return res.status(404).json({ error: 'No encontrado' });
  if (draft.status === 'COMPLETADO') return res.status(400).json({ error: 'Este documento ya quedó completo' });

  const miFirma = draft.signers.find((s) => s.userId === req.user.id);
  if (!miFirma) return res.status(403).json({ error: 'No te corresponde firmar este documento' });
  if (miFirma.signedAt) return res.status(400).json({ error: 'Ya firmaste este documento' });

  const yo = await prisma.user.findUnique({ where: { id: req.user.id }, select: { signatureData: true } });
  let firmaAUsar = signature || yo?.signatureData || null;
  if (!firmaAUsar) {
    return res.status(400).json({ error: 'No tienes una firma guardada. Sube o dibuja tu firma primero.' });
  }
  // Si el usuario no tenía firma guardada en su perfil, esta se la guarda para la próxima vez.
  if (!yo?.signatureData) {
    await prisma.user.update({ where: { id: req.user.id }, data: { signatureData: firmaAUsar } });
  }

  await prisma.documentSigner.update({
    where: { id: miFirma.id },
    data: { signedAt: new Date(), signature: firmaAUsar },
  });

  await notificar({
    userId: draft.createdById,
    type: 'FIRMA',
    title: 'Firma registrada',
    message: `${miFirma.user.firstName} ${miFirma.user.lastName} ya firmó "${draft.title}".`,
    link: '/documentos',
  });

  const actualizado = await prisma.documentDraft.findUnique({ where: { id }, include: INCLUIR });
  const faltan = actualizado.signers.some((s) => !s.signedAt);

  if (!faltan) {
    // Ya firmaron todos: se arma el documento final y queda guardado en la carpeta personal del dueño
    const fechaTexto = actualizado.fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const principal = actualizado.signers.find((s) => s.order === 1);
    const segundo = actualizado.signers.find((s) => s.order === 2);

    const introTexto = reemplazarTokens(actualizado.template.intro, {
      persona: `${principal.user.firstName} ${principal.user.lastName}`,
      cargo: principal.user.cargo || '',
      fecha: fechaTexto,
      firmante2: segundo ? `${segundo.user.firstName} ${segundo.user.lastName}` : '',
      firmante2Cargo: segundo?.user.cargo || '',
    });

    const camposTabla = (actualizado.template.fields || []).map((c) => ({
      label: c.label,
      value: actualizado.values[c.key] || '',
    }));

    const html = construirDocumentoHTML({
      nombrePlantilla: actualizado.template.name,
      introTexto,
      camposTabla,
      imageData: actualizado.imageData,
      firmante1: { nombre: `${principal.user.firstName} ${principal.user.lastName}`, cargo: principal.user.cargo, firma: principal.signature },
      firmante2: segundo ? { nombre: `${segundo.user.firstName} ${segundo.user.lastName}`, cargo: segundo.user.cargo, firma: segundo.signature } : null,
    });

    const fileData = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

    const documentoFinal = await prisma.document.create({
      data: {
        title: `${actualizado.template.name} — ${principal.user.firstName} ${principal.user.lastName}`,
        fileName: `${actualizado.template.name.replace(/\s+/g, '-')}-${principal.user.firstName}-${actualizado.fecha.toISOString().slice(0, 10)}.html`,
        mimeType: 'text/html',
        fileData,
        scope: 'PERSONAL',
        documentTypeId: actualizado.documentTypeId,
        ownerId: actualizado.ownerId,
        uploadedById: actualizado.createdById,
      },
    });

    await prisma.documentDraft.update({
      where: { id },
      data: { status: 'COMPLETADO', documentId: documentoFinal.id },
    });

    const aAvisar = new Set([actualizado.createdById, actualizado.ownerId]);
    await Promise.all(
      [...aAvisar].map((userId) =>
        notificar({
          userId,
          type: 'FIRMA',
          title: 'Documento completo',
          message: `"${actualizado.title}" ya tiene todas las firmas y está disponible en Documentos.`,
          link: '/documentos',
        })
      )
    );
  }

  const final = await prisma.documentDraft.findUnique({ where: { id }, include: INCLUIR });
  res.json(final);
});

module.exports = router;
