# Intranet ESPAC — Fase 1

Sistema separado del CRM, con su propio login. Esta primera fase deja lista
la base sobre la que se construyen todos los módulos siguientes:

- Login con usuario y contraseña
- Creación de usuarios desde Admin (usuario y contraseña se generan solos)
- Roles (Admin, Gerencia, RRHH, Marketing, Ventas, Instructor, Colaborador)
- Áreas / Tags (editable por Admin)
- Mi Perfil (datos, estado presencial/home office, horario)
- Compañía (directorio de todo el personal)
- Notificaciones en tiempo real (campanita, lista para usarse en las
  siguientes fases: Anuncios, Solicitudes, Chat, Programaciones...)
- Cambio de contraseña obligatorio en el primer ingreso, y reseteo desde Admin

Mismo esquema que el CRM: **backend en Railway** (con base de datos Postgres)
y **frontend en Vercel**.

---

## Paso 1 — Crear el repositorio en GitHub

1. Entra a GitHub y crea un repositorio nuevo, por ejemplo `intranet-espac`
   (puede ser privado).
2. Sube estas dos carpetas (`backend` y `frontend`) tal como están, junto con
   este `README.md`.

## Paso 2 — Backend en Railway

1. En Railway, **New Project → Deploy from GitHub repo** → elige `intranet-espac`.
2. En "Settings" del servicio, en **Root Directory** pon `backend`.
3. Dale **"+ New" → Database → Add PostgreSQL** dentro del mismo proyecto.
   Railway crea automáticamente la variable `DATABASE_URL` y te deja
   referenciarla en el backend.
4. En el servicio del backend, ve a **Variables** y agrega:
   - `DATABASE_URL` → referencia a la base de datos que acabas de crear
     (Railway te la sugiere automáticamente)
   - `JWT_SECRET` → cualquier texto largo y secreto que tú inventes
   - `FRONTEND_URL` → lo dejamos pendiente, lo completamos en el Paso 4
     (por ahora puedes poner `*`)
5. En **Settings → Deploy**, verifica que el "Start Command" sea `npm start`.
6. Antes del primer arranque necesitamos crear las tablas en la base de datos.
   En Railway, entra a la pestaña del servicio backend → **Shell** (o desde tu
   compu con `railway run`) y ejecuta:
   ```
   npx prisma migrate deploy
   node prisma/seed.js
   ```
   Si `migrate deploy` te dice que no hay migraciones todavía, usa en su lugar:
   ```
   npx prisma migrate dev --name init
   node prisma/seed.js
   ```
7. El comando `seed.js` te va a mostrar en pantalla tu **usuario Admin** y su
   **contraseña temporal**. Guárdalos — son los que vas a usar para entrar
   por primera vez.
8. Railway te da una URL pública tipo `intranet-espac-production.up.railway.app`.
   Guárdala, es el "cerebro" del sistema (como en el CRM).

## Paso 3 — Frontend en Vercel

1. En Vercel, **Add New → Project** → importa el mismo repositorio `intranet-espac`.
2. En **Root Directory**, elige la carpeta `frontend`.
3. En **Environment Variables** agrega:
   - `VITE_API_URL` = `https://TU-URL-DE-RAILWAY.up.railway.app/api`
   (con `/api` al final, igual que en el CRM)
4. Dale **Deploy**. Vercel te da un link tipo `intranet-espac.vercel.app`.

## Paso 4 — Conectar ambos lados

1. Vuelve a Railway, a las variables del backend, y actualiza `FRONTEND_URL`
   con el link que te dio Vercel (sin `/` al final), por ejemplo:
   `https://intranet-espac.vercel.app`
2. Railway va a reiniciar el backend solo.

## Paso 5 — Primer ingreso

1. Abre el link de Vercel.
2. Entra con el usuario y la contraseña temporal que te dio `seed.js`.
3. El sistema te va a pedir crear tu propia contraseña de una vez.
4. Ya en el sistema, ve a **Áreas / Tags** y crea las áreas de ESPAC
   (ej: Ventas, Marketing, RRHH, Vuelos, Simuladores, Teoría...).
5. Luego ve a **Usuarios** y empieza a crear a todo el personal — el usuario
   y la contraseña de cada uno se generan solos, tú solo se los compartes.

---

Cuando confirmes que esta Fase 1 está funcionando en producción (login,
crear usuarios, ver compañía, mi perfil, notificaciones), seguimos con la
**Fase 2: Anuncios y Calendario**.
