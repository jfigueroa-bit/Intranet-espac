const prisma = require('../lib/prisma');

// Deja pasar a Admin, RRHH, o a cualquier persona que sea jefe directo de
// alguien (tenga reportes en el organigrama de la Fase 3). A los jefes que no
// son Admin/RRHH los marcamos con req.esJefeDeArea para limitar, más abajo en
// cada ruta, a qué documentos personales pueden subir (solo a su propia gente).
async function requireGestorDocumentos(req, res, next) {
  if (req.user.role === 'ADMIN' || req.user.role === 'RRHH') {
    req.esJefeDeArea = false;
    return next();
  }

  const reportes = await prisma.user.count({ where: { managerId: req.user.id, isActive: true } });
  if (reportes > 0) {
    req.esJefeDeArea = true;
    return next();
  }

  return res.status(403).json({ error: 'No tienes permiso para subir documentos' });
}

module.exports = { requireGestorDocumentos };
