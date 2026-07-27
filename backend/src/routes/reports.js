const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function claveDeMes(fecha) {
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ultimosMeses(cantidad) {
  const resultado = [];
  const hoy = new Date();
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    resultado.push({ clave, etiqueta: `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
  }
  return resultado;
}

router.get('/resumen', requireAuth, requireRole('ADMIN', 'GERENCIA'), async (req, res) => {
  const meses = ultimosMeses(6);
  const desde = new Date(`${meses[0].clave}-01T00:00:00.000Z`);
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const [alumnos, pagos, cursos, sesiones] = await Promise.all([
    prisma.student.findMany({
      where: { enrollmentDate: { gte: desde } },
      select: { enrollmentDate: true },
    }),
    prisma.payment.findMany({
      where: { paidDate: { gte: desde } },
      select: { paidDate: true, amount: true, currency: true },
    }),
    prisma.course.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: { students: { _count: 'desc' } },
      take: 6,
    }),
    prisma.scheduleSession.findMany({
      where: { date: { gte: hace30Dias } },
      include: { instructor: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const alumnosPorMes = meses.map(({ clave, etiqueta }) => ({
    mes: etiqueta,
    alumnos: alumnos.filter((a) => claveDeMes(a.enrollmentDate) === clave).length,
  }));

  const ingresosPorMes = meses.map(({ clave, etiqueta }) => {
    const delMes = pagos.filter((p) => claveDeMes(p.paidDate) === clave);
    return {
      mes: etiqueta,
      soles: delMes.filter((p) => p.currency === 'PEN').reduce((s, p) => s + p.amount, 0),
      dolares: delMes.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.amount, 0),
    };
  });

  const cursosPopulares = cursos.map((c) => ({ curso: c.name, alumnos: c._count.students }));

  const porInstructor = {};
  sesiones.forEach((s) => {
    const nombre = `${s.instructor.firstName} ${s.instructor.lastName}`;
    porInstructor[nombre] = (porInstructor[nombre] || 0) + 1;
  });
  const sesionesPorInstructor = Object.entries(porInstructor)
    .map(([instructor, sesiones]) => ({ instructor, sesiones }))
    .sort((a, b) => b.sesiones - a.sesiones)
    .slice(0, 8);

  res.json({ alumnosPorMes, ingresosPorMes, cursosPopulares, sesionesPorInstructor });
});

module.exports = router;
