// Crea el primer usuario Admin, para poder entrar por primera vez y luego
// crear a todos los demás desde el panel de administración.
// Se ejecuta UNA sola vez con: node prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { generarUsername, generarPasswordTemporal } = require('../src/utils/username');

const prisma = new PrismaClient();

async function main() {
  const existente = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existente) {
    console.log('Ya existe un usuario Admin:', existente.username);
    return;
  }

  const firstName = 'Jimena';
  const lastName = 'Admin';
  const email = 'admin@espac.edu.pe'; // cámbialo por tu correo real institucional
  const sequenceNumber = 1;
  const username = generarUsername(firstName, lastName, sequenceNumber);
  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const admin = await prisma.user.create({
    data: {
      sequenceNumber,
      username,
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'ADMIN',
      cargo: 'Administrador del sistema',
      mustChangePassword: true,
    },
  });

  console.log('======================================');
  console.log('Usuario Admin creado. Guarda estos datos:');
  console.log('Usuario:     ', admin.username);
  console.log('Contraseña:  ', passwordTemporal);
  console.log('======================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
