import { useEffect, useState } from 'react';

export default function Reloj() {
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fecha = ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
      {fecha} · <strong style={{ color: 'var(--text)' }}>{hora}</strong>
    </div>
  );
}
