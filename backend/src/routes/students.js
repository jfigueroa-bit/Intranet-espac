const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { siguienteCodigoAlumno } = require('../utils/studentCode');

const router = express.Router();

const INCLUIR = { course: true };

// Convierte "YYYY-MM-DD" a mediodía UTC de ese día, para que no se desfase por zona horaria
function fechaSoloDia(texto) {
  const [y, m, d] = texto.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

// GET /api/students -> lista de alumnos (cualquier usuario logueado), con búsqueda opcional
router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  const alumnos = await prisma.student.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {},
    include: INCLUIR,
    orderBy: { sequenceNumber: 'desc' },
  });
  res.json(alumnos);
});

// GET /api/students/:id -> ficha de un alumno
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const alumno = await prisma.student.findUnique({ where: { id }, include: INCLUIR });
  if (!alumno) return res.status(404).json({ error: 'No encontrado' });
  res.json(alumno);
});

// POST /api/students -> matricula un alumno nuevo (el código se genera solo)
router.post('/', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const { firstName, lastName, email, phone, courseId, notes, enrollmentDate } = req.body;
  if (!firstName?.trim() || !lastName?.trim()) {
    return res.status(400).json({ error: 'Nombre y apellido son obligatorios' });
  }

  const { sequenceNumber, code } = await siguienteCodigoAlumno();

  const alumno = await prisma.student.create({
    data: {
      sequenceNumber,
      code,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email || null,
      phone: phone || null,
      courseId: courseId ? Number(courseId) : null,
      notes: notes || null,
      enrollmentDate: enrollmentDate ? fechaSoloDia(enrollmentDate) : new Date(),
    },
    include: INCLUIR,
  });

  res.status(201).json(alumno);
});

// POST /api/students/importar -> carga masiva desde Excel (el frontend ya lo lee y manda un arreglo)
router.post('/importar', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const { alumnos } = req.body;
  if (!Array.isArray(alumnos) || alumnos.length === 0) {
    return res.status(400).json({ error: 'No se recibió ninguna fila para importar' });
  }

  const cursosExistentes = await prisma.course.findMany();
  const mapaCursos = new Map(cursosExistentes.map((c) => [c.name.toLowerCase(), c.id]));

  let creados = 0;
  const errores = [];

  for (let i = 0; i < alumnos.length; i++) {
    const fila = alumnos[i];
    const firstName = (fila.firstName || '').trim();
    const lastName = (fila.lastName || '').trim();

    if (!firstName || !lastName) {
      errores.push(`Fila ${i + 2}: falta nombre o apellido`);
      continue;
    }

    let courseId = null;
    const nombreCurso = (fila.course || '').trim();
    if (nombreCurso) {
      const clave = nombreCurso.toLowerCase();
      if (mapaCursos.has(clave)) {
        courseId = mapaCursos.get(clave);
      } else {
        const nuevoCurso = await prisma.course.create({ data: { name: nombreCurso } });
        mapaCursos.set(clave, nuevoCurso.id);
        courseId = nuevoCurso.id;
      }
    }

    const { sequenceNumber, code } = await siguienteCodigoAlumno();

    await prisma.student.create({
      data: {
        sequenceNumber,
        code,
        firstName,
        lastName,
        email: fila.email || null,
        phone: fila.phone || null,
        courseId,
        groundCourseHours: Number(fila.groundCourseHours) || 0,
        flightHours: Number(fila.flightHours) || 0,
        simulatorHours: Number(fila.simulatorHours) || 0,
        enrollmentDate: fila.enrollmentDate ? new Date(fila.enrollmentDate) : new Date(),
      },
    });
    creados++;
  }

  res.json({ creados, errores });
});

// PATCH /api/students/:id -> edita datos y horas (Admin, Gerencia, Ventas, o Instructor)
router.patch('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS', 'INSTRUCTOR'), async (req, res) => {
  const id = Number(req.params.id);
  const {
    firstName, lastName, email, phone, courseId,
    groundCourseHours, flightHours, simulatorHours, notes, isActive, enrollmentDate,
  } = req.body;

  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (courseId !== undefined) data.courseId = courseId ? Number(courseId) : null;
  if (groundCourseHours !== undefined) data.groundCourseHours = Number(groundCourseHours) || 0;
  if (flightHours !== undefined) data.flightHours = Number(flightHours) || 0;
  if (simulatorHours !== undefined) data.simulatorHours = Number(simulatorHours) || 0;
  if (notes !== undefined) data.notes = notes || null;
  if (isActive !== undefined) data.isActive = isActive;
  if (enrollmentDate !== undefined) data.enrollmentDate = fechaSoloDia(enrollmentDate);

  const actualizado = await prisma.student.update({ where: { id }, data, include: INCLUIR });
  res.json(actualizado);
});

// DELETE /api/students/:id -> Admin o Gerencia
router.delete('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.student.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
