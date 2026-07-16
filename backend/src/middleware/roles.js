// Uso: requireRole('ADMIN') o requireRole('ADMIN', 'RRHH')
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para hacer esto' });
    }
    next();
  };
}

module.exports = { requireRole };
