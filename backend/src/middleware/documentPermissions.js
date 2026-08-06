// Cualquier usuario logueado puede crear documentos y mandarlos a firmar.
// Se deja "esJefeDeArea" en false para todos, así ninguna ruta les restringe
// a quién le pueden mandar un documento personal (antes solo Admin/RRHH
// tenían ese alcance completo; ahora lo tiene cualquiera).
async function requireGestorDocumentos(req, res, next) {
  req.esJefeDeArea = false;
  return next();
}

module.exports = { requireGestorDocumentos };
