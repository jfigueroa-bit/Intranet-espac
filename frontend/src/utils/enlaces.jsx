import { createElement } from 'react';

const REGEX_URL = /(https?:\/\/[^\s]+)/g;

// Recibe un texto plano y devuelve un arreglo de nodos de React: el texto
// normal tal cual, y los links convertidos en enlaces clickeables que abren
// en una pestaña nueva. Usa createElement en vez de JSX a propósito, para
// evitar el problema de copiado que rompía el build.
export function conEnlacesClickeables(texto) {
  if (!texto) return texto;
  const partes = texto.split(REGEX_URL);
  return partes.map(function (parte, i) {
    if (parte.match(REGEX_URL)) {
      return createElement(
        'a',
        {
          key: i,
          href: parte,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: { color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' },
        },
        parte
      );
    }
    return parte;
  });
}
