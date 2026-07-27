require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const areasRoutes = require('./routes/areas');
const notificationsRoutes = require('./routes/notifications');
const announcementsRoutes = require('./routes/announcements');
const eventsRoutes = require('./routes/events');
const documentTypesRoutes = require('./routes/documentTypes');
const documentsRoutes = require('./routes/documents');
const documentTemplatesRoutes = require('./routes/documentTemplates');
const documentDraftsRoutes = require('./routes/documentDrafts');
const vacationsRoutes = require('./routes/vacations');
const chatsRoutes = require('./routes/chats');
const coursesRoutes = require('./routes/courses');
const studentsRoutes = require('./routes/students');
const studentCoursesRoutes = require('./routes/studentCourses');
const schedulesRoutes = require('./routes/schedules');
const requestsRoutes = require('./routes/requests');
const pushRoutes = require('./routes/push');
const paymentsRoutes = require('./routes/payments');
const aircraftTypesRoutes = require('./routes/aircraftTypes');
const simulatorTypesRoutes = require('./routes/simulatorTypes');
const flightLogsRoutes = require('./routes/flightLogs');
const simulatorLogsRoutes = require('./routes/simulatorLogs');
const searchRoutes = require('./routes/search');
const { setIO, salaDeUsuario } = require('./utils/socket');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || '*';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'intranet-espac-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/document-types', documentTypesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/document-templates', documentTemplatesRoutes);
app.use('/api/document-drafts', documentDraftsRoutes);
app.use('/api/vacations', vacationsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/student-courses', studentCoursesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/aircraft-types', aircraftTypesRoutes);
app.use('/api/simulator-types', simulatorTypesRoutes);
app.use('/api/flight-logs', flightLogsRoutes);
app.use('/api/simulator-logs', simulatorLogsRoutes);
app.use('/api/search', searchRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err?.code === 'P2002') {
    return res.status(400).json({ error: 'Ya existe un registro con ese dato único (correo o usuario duplicado)' });
  }
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor' });
});

const io = new Server(server, {
  cors: { origin: FRONTEND_URL },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Sin token'));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = payload;
    next();
  } catch (err) {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  socket.join(salaDeUsuario(socket.user.id));
});

setIO(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Intranet ESPAC backend corriendo en el puerto ${PORT}`);
});
