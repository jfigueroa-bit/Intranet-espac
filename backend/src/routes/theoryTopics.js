const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/theory-topics?courseId=123 -> todos los temas, o solo los de un curso
router.get('/', requireAuth, async (req, res) => {
  const { courseId } = req.query;
  const temas = await prisma.theoryTopic.findMany({
    where: courseId ? { courseId: Number(courseId) } : undefined,
    include: { course: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(temas);
});

// POST /api/theory-topics -> crea un tema, opcionalmente ligado a un curso (currícula).
// Si se liga a un curso que ya tiene alumnos inscritos, se les crea de una vez
// su nota en blanco para ese tema nuevo.
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, courseId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const tema = await prisma.theoryTopic.create({
    data: { name: name.trim(), courseId: courseId ? Number(courseId) : null },
    include: { course: { select: { id: true, name: true } } },
  });

  if (tema.courseId) {
    const inscripciones = await prisma.studentCourse.findMany({
      where: { courseId: tema.courseId },
      select: { id: true },
    });
    if (inscripciones.length > 0) {
      await prisma.curriculumGrade.createMany({
        data: inscripciones.map((i) => ({ studentCourseId: i.id, theoryTopicId: tema.id })),
        skipDuplicates: true,
      });
    }
  }

  res.status(201).json(tema);
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.theoryTopic.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
