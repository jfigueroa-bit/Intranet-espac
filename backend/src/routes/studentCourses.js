const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/student-courses?studentId=123 -> historial de cursos de un alumno
router.get('/', requireAuth, async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Falta indicar el alumno' });

  const inscripciones = await prisma.studentCourse.findMany({
    where: { studentId: Number(studentId) },
    include: { course: true },
    orderBy: { enrolledAt: 'desc' },
  });
  res.json(inscripciones);
});

// POST /api/student-courses -> inscribe a un alumno en un curso (puede tener varios).
// Apenas se inscribe, se crea automáticamente su "currícula" en blanco: una nota
// (todavía sin calificar) por cada tema de teoría que tenga asignado ese curso.
router.post('/', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const { studentId, courseId, status } = req.body;
  if (!studentId || !courseId) {
    return res.status(400).json({ error: 'Faltan datos (alumno y curso)' });
  }

  const inscripcion = await prisma.studentCourse.create({
    data: {
      studentId: Number(studentId),
      courseId: Number(courseId),
      status: status || 'EN_CURSO',
    },
    include: { course: true },
  });

  const temas = await prisma.theoryTopic.findMany({
    where: { courseId: Number(courseId) },
    select: { id: true },
  });
  if (temas.length > 0) {
    await prisma.curriculumGrade.createMany({
      data: temas.map((t) => ({ studentCourseId: inscripcion.id, theoryTopicId: t.id })),
      skipDuplicates: true,
    });
  }

  res.status(201).json(inscripcion);
});

// PATCH /api/student-courses/:id -> cambia el estado (en curso / completado)
router.patch('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!['EN_CURSO', 'COMPLETADO'].includes(status)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }

  const actualizada = await prisma.studentCourse.update({
    where: { id },
    data: { status, completedAt: status === 'COMPLETADO' ? new Date() : null },
    include: { course: true },
  });
  res.json(actualizada);
});

// DELETE /api/student-courses/:id -> elimina una inscripción del historial
// (también se borran en cascada sus notas de currícula)
router.delete('/:id', requireAuth, requireRole('ADMIN', 'GERENCIA', 'VENTAS'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.studentCourse.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
