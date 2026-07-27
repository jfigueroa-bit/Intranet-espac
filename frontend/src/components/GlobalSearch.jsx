import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState({ usuarios: [], alumnos: [] });
  const [buscando, setBuscando] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    function alHacerClicFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', alHacerClicFuera);
    return () => document.removeEventListener('mousedown', alHacerClicFuera);
  }, []);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados({ usuarios: [], alumnos: [] });
      return;
    }
    setBuscando(true);
    const temporizador = setTimeout(() => {
      api.get('/search', { params: { q: texto.trim() } })
        .then((res) => setResultados(res.data))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [texto]);

  function irAPersona() {
    setAbierto(false);
    setTexto('');
    navigate('/compania');
  }

  function irAAlumno(alumno) {
    setAbierto(false);
    setTexto('');
    navigate(`/alumnos?buscar=${encodeURIComponent(alumno.code)}`);
  }

  const hayResultados = resultados.usuarios.length > 0 || resultados.alumnos.length > 0;

  return (
    <div ref={contenedorRef} style={{ position: 'relative', width: 260 }}>
      <input
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        placeholder="🔍 Buscar personas o alumnos..."
        style={{ width: '100%', fontSize: 13, padding: '7px 12px' }}
      />

      {abierto && texto.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: 38, left: 0, width: '100%', background: '#fff',
          border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 90, maxHeight: 360, overflowY: 'auto',
        }}>
          {buscando && <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>Buscando...</div>}

          {!buscando && !hayResultados && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>Sin resultados para "{texto}".</div>
          )}

          {!buscando && resultados.usuarios.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                👤 Personas
              </div>
              {resultados.usuarios.map((u) => (
                <div
                  key={u.id}
                  onClick={irAPersona}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', flexDirection: 'column' }}
                >
                  <strong>{u.firstName} {u.lastName}</strong>
                  {u.cargo && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.cargo}</span>}
                </div>
              ))}
            </div>
          )}

          {!buscando && resultados.alumnos.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                🎓 Alumnos
              </div>
              {resultados.alumnos.map((a) => (
                <div
                  key={a.id}
                  onClick={() => irAAlumno(a)}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', flexDirection: 'column' }}
                >
                  <strong>{a.firstName} {a.lastName}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
