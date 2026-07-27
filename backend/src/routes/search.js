const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/search?q=texto -> busca personas (Compañía) y alumnos a la vez.
// No incluye Documentos todavía, para no arriesgarnos a mostrar algo que el
// usuario no debería ver según los permisos de área de cada tipo de documento.
router.get('/', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ usuarios: [], alumnos: [] });
  }

  const [usuarios, alumnos] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { cargo: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, cargo: true },
      take: 6,
    }),
    prisma.student.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, code: true },
      take: 6,
    }),
  ]);

  res.json({ usuarios, alumnos });
});

module.exports = router;
