import { useRef, useState } from 'react';

export default function FirmaCanvas({ onGuardar, textoBoton = 'Usar esta firma' }) {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  function posicion(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function empezar(e) {
    e.preventDefault();
    dibujando.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = posicion(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e) {
    if (!dibujando.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = posicion(e, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1c1c1e';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setTieneTrazo(true);
  }

  function terminar() {
    dibujando.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
  }

  function guardar() {
    if (!tieneTrazo) return;
    onGuardar(canvasRef.current.toDataURL('image/png'));
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', touchAction: 'none', cursor: 'crosshair', maxWidth: '100%' }}
        onMouseDown={empezar}
        onMouseMove={mover}
        onMouseUp={terminar}
        onMouseLeave={terminar}
        onTouchStart={empezar}
        onTouchMove={mover}
        onTouchEnd={terminar}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn secondary" onClick={limpiar} style={{ padding: '6px 14px', fontSize: 13 }}>Limpiar</button>
        <button type="button" className="btn" onClick={guardar} disabled={!tieneTrazo} style={{ padding: '6px 14px', fontSize: 13 }}>
          {textoBoton}
        </button>
      </div>
    </div>
  );
}
