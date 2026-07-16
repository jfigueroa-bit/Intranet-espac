const prisma = require('../lib/prisma');

let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

// Cada usuario, al conectarse por socket, se une a una "sala" con su propio id
// (ver src/index.js). Así podemos mandarle notificaciones solo a él.
function salaDeUsuario(userId) {
  return `user:${userId}`;
}

// Crea la notificación en la base de datos Y la manda en tiempo real
// si el usuario está conectado. type: "SISTEMA" | "ANUNCIO" | "SOLICITUD" |
// "PROGRAMACION" | "VACACIONES" | "CHAT" | "DOCUMENTO"
async function notificar({ userId, type, title, message, link = null }) {
  const noti = await prisma.notification.create({
    data: { userId, type, title, message, link },
  });

  if (ioInstance) {
    ioInstance.to(salaDeUsuario(userId)).emit('notificacion:nueva', noti);
  }

  return noti;
}

module.exports = { setIO, salaDeUsuario, notificar };
