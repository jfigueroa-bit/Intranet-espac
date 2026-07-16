const { PrismaClient } = require('@prisma/client');

// Evita crear múltiples conexiones cuando el servidor recarga en desarrollo
const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
