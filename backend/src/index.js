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
const { setIO, salaDeUsuario } = require('./utils/socket');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || '*';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '15mb' }));

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

// Manejador de errores general: si una ruta falla sin haberlo previsto,
// devolvemos un mensaje claro en vez de que el navegador reciba una
// respuesta vacía o incomprensible.
app.use((err, req, res, next) => {
  console.error(err);
  if (err?.code === 'P2002') {
    // Error típico de Prisma: se intentó guardar un valor único (correo, usuario) duplicado
    return res.status(400).json({ error: 'Ya existe un registro con ese dato único (correo o usuario duplicado)' });
  }
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor' });
});

// --- Socket.io: tiempo real (notificaciones, y luego chat/solicitudes) ---
const io = new Server(server, {
  cors: { origin: FRONTEND_URL },
});

// Cada conexión de socket debe mandar su token para saber quién es
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
  // Cada usuario entra a su propia "sala" -> así le llegan solo sus notificaciones
  socket.join(salaDeUsuario(socket.user.id));
});

setIO(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Intranet ESPAC backend corriendo en el puerto ${PORT}`);
});
