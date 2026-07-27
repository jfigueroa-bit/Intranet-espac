const prisma = require('../lib/prisma');
const { enviarCorreo } = require('./email');
const { enviarPush } = require('./webpush');

let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function salaDeUsuario(userId) {
  return `user:${userId}`;
}

// Crea la notificación en la base de datos, la manda en tiempo real por
// socket, Y ADEMÁS manda un correo y una notificación push al celular/navegador.
async function notificar({ userId, type, title, message, link = null }) {
  const noti = await prisma.notification.create({
    data: { userId, type, title, message, link },
  });

  if (ioInstance) {
    ioInstance.to(salaDeUsuario(userId)).emit('notificacion:nueva', noti);
  }

  prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    .then((u) => u?.email && enviarCorreo({ to: u.email, subject: title, message, link }))
    .catch(() => {});

  enviarPush(userId, { title, message, link }).catch(() => {});

  return noti;
}

function emitirAUsuario(userId, evento, payload) {
  if (ioInstance) {
    ioInstance.to(salaDeUsuario(userId)).emit(evento, payload);
  }
}

module.exports = { setIO, salaDeUsuario, notificar, emitirAUsuario };
