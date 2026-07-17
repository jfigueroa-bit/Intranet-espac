function construirArbol(usuarios) {
  const porId = {};
  usuarios.forEach((u) => { porId[u.id] = { ...u, hijos: [] }; });

  const raices = [];
  usuarios.forEach((u) => {
    if (u.managerId && porId[u.managerId]) {
      porId[u.managerId].hijos.push(porId[u.id]);
    } else {
      raices.push(porId[u.id]);
    }
  });

  const ordenar = (a, b) => (a.hierarchyOrder - b.hierarchyOrder) || a.firstName.localeCompare(b.firstName);
  Object.values(porId).forEach((n) => n.hijos.sort(ordenar));
  raices.sort(ordenar);
  return raices;
}

function Nodo({ persona, nivel }) {
  return (
    <div style={{ marginLeft: nivel === 0 ? 0 : 24, borderLeft: nivel === 0 ? 'none' : '2px solid var(--border)', paddingLeft: nivel === 0 ? 0 : 16, marginTop: 8 }}>
      <div className="card" style={{ padding: '10px 14px', display: 'inline-block', minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{persona.firstName} {persona.lastName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{persona.cargo || 'Sin cargo'}</div>
      </div>
      {persona.hijos.map((hijo) => (
        <Nodo key={hijo.id} persona={hijo} nivel={nivel + 1} />
      ))}
    </div>
  );
}

export default function OrgChart({ usuarios }) {
  const raices = construirArbol(usuarios);

  if (raices.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No hay usuarios para mostrar.</div>;
  }

  return (
    <div>
      {raices.map((r) => (
        <Nodo key={r.id} persona={r} nivel={0} />
      ))}
    </div>
  );
}
