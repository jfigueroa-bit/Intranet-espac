const webpush = require('web-push');
const prisma = require('../lib/prisma');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:soporte@espac.pe', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function enviarPush(userId, { title, message, link }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const suscripciones = await prisma.pushSubscription.findMany({ where: { userId } });
  if (suscripciones.length === 0) return;

  const payload = JSON.stringify({ title, body: message, link: link || '/' });

  await Promise.all(
    suscripciones.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}

module.exports = { enviarPush };
