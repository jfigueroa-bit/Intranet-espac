import api from '../api/client';

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

export async function activarNotificacionesPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Este navegador no soporta notificaciones push.');
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('No diste permiso para recibir notificaciones.');
  }

  const registro = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const { data } = await api.get('/push/clave-publica');
  if (!data.publicKey) {
    throw new Error('Las notificaciones push todavía no están configuradas en el servidor.');
  }

  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(data.publicKey),
  });

  await api.post('/push/suscribirse', suscripcion.toJSON());
  return true;
}

export async function estaActivadoPush() {
  if (!('serviceWorker' in navigator)) return false;
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) return false;
  const suscripcion = await registro.pushManager.getSubscription();
  return !!suscripcion;
}
