// Un "ding" cortito generado con la Web Audio API, para no depender de
// ningún archivo de sonido externo. Si el navegador bloquea el audio por
// política de autoplay, simplemente no suena (no rompe nada).
export function reproducirSonidoNotificacion() {
  try {
    const ContextoAudio = window.AudioContext || window.webkitAudioContext;
    if (!ContextoAudio) return;
    const ctx = new ContextoAudio();

    const tono = (frecuencia, inicio, duracion) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + inicio + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracion);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracion);
    };

    tono(880, 0, 0.12);
    tono(1175, 0.1, 0.15);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // si el navegador no deja reproducir sonido, no pasa nada
  }
}
