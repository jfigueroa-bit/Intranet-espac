// Genera usuarios con el formato: J.Rios.Espac.0001
// (inicial del primer nombre) . (primer apellido) . Espac . (número secuencial de 4 dígitos)

function limpiar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-zA-Z]/g, '')       // solo letras
    .trim();
}

function generarUsername(firstName, lastName, sequenceNumber) {
  const primerNombre = limpiar(firstName.split(' ')[0]);
  const primerApellido = limpiar(lastName.split(' ')[0]);
  const inicial = primerNombre.charAt(0).toUpperCase();
  const apellidoCap =
    primerApellido.charAt(0).toUpperCase() + primerApellido.slice(1).toLowerCase();
  const numero = String(sequenceNumber).padStart(4, '0');
  return `${inicial}.${apellidoCap}.Espac.${numero}`;
}

function generarPasswordTemporal() {
  // Contraseña temporal legible, ej: Espac-4f7a2b
  const random = Math.random().toString(36).slice(-6);
  return `Espac-${random}`;
}

module.exports = { generarUsername, generarPasswordTemporal };
