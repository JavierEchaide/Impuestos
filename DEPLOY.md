# Despliegue de Cuentas Claras en Vercel

Guía paso a paso para publicar la app con **GitHub + Vercel + Neon (Postgres)**. No hace falta la CLI de Vercel:
todo se puede hacer desde el navegador. Al final hay una [checklist de verificación](#7-checklist-de-verificación-tras-desplegar).

> **Qué necesitas:** una cuenta de GitHub, una cuenta de Vercel (vale el plan gratuito *Hobby*) y Node.js 22+ en tu
> ordenador para ejecutar las migraciones y el seed una vez.

---

## 1. Subir el proyecto a GitHub

El código ya está en el repositorio `JavierEchaide/Impuestos`. El trabajo se ha hecho en la rama
`claude/brave-sagan-j4texj`.

1. Entra en el repositorio en GitHub. Verás un aviso amarillo «claude/brave-sagan-j4texj had recent pushes» con el botón
   **Compare & pull request**.
2. Revisa los cambios y fusiónalos en `main` (**Create pull request → Merge pull request**).
   - Vercel despliega **producción desde `main`**. Si el repositorio aún no tiene rama `main`, créala desde esa pantalla
     o cambia la *Production Branch* en Vercel (Settings → Git) a `claude/brave-sagan-j4texj`.
3. Comprueba que **no se ha subido ningún secreto**: en la raíz del repositorio debe existir `.env.example` pero **no** `.env`.

## 2. Importar el repositorio en Vercel

1. Entra en <https://vercel.com/new> (pantalla con el título *Let's build something new* y una lista de tus repositorios).
2. Si no ves el repositorio, pulsa **Adjust GitHub App Permissions** y concede acceso a `Impuestos`.
3. Pulsa **Import** junto a `JavierEchaide/Impuestos`.
4. En la pantalla *Configure Project*:
   - **Project Name:** `cuentas-claras`.
   - **Framework Preset:** Next.js (se detecta solo).
   - **Root Directory / Build Command / Output Directory:** déjalos por defecto.
5. **Todavía no pulses Deploy.** Primero añade la base de datos y las variables (pasos 3 y 4). Si ya lo pulsaste, no
   pasa nada: el primer despliegue fallará o no funcionará hasta que las configures, y luego harás **Redeploy**.

## 3. Añadir Neon (Postgres) desde el Marketplace

1. En el panel del proyecto, abre la pestaña **Storage** (columna izquierda o menú superior).
2. Pulsa **Create Database** (o **Browse Marketplace**) y elige **Neon** (*Serverless Postgres*).
3. Acepta los términos, pon un nombre (`cuentas-claras-db`) y elige la región **Frankfurt (eu-central-1)**, la más
   cercana a España. Plan *Free*.
4. En la pantalla *Connect Project* marca el proyecto `cuentas-claras` y los entornos **Production, Preview y Development**.
5. Pulsa **Connect**. Vercel crea las variables `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (y alguna más de Neon)
   automáticamente. Compruébalo en **Settings → Environment Variables**.

## 4. Variables de entorno (incluido el secreto de autenticación)

En **Settings → Environment Variables** añade estas dos (marca *Production*, *Preview* y *Development*):

| Nombre | Valor |
| --- | --- |
| `BETTER_AUTH_SECRET` | Un secreto aleatorio de 32+ caracteres. Genéralo en tu terminal con `openssl rand -base64 32` y pégalo. **No lo compartas ni lo subas a Git.** |
| `BETTER_AUTH_URL` | La URL pública, p. ej. `https://cuentas-claras.vercel.app` (la que te asigne Vercel en *Domains*). |

> Si cambias el dominio más adelante, actualiza `BETTER_AUTH_URL` y haz *Redeploy*.
> Cambiar `BETTER_AUTH_SECRET` cierra todas las sesiones abiertas.

Ahora sí: vuelve a **Deployments** y lanza el despliegue (o **Redeploy** si ya existía).

## 5. Migraciones y seed contra la base de datos de producción

Las tablas no se crean solas al desplegar: hay que aplicar las migraciones **una vez** (y de nuevo cuando añadas migraciones nuevas).

En tu ordenador, dentro de la carpeta del proyecto:

```bash
npm install
```

Trae las variables de Vercel a un archivo local (ignorado por Git). La primera vez, enlaza el proyecto con la CLI;
si prefieres no usarla, copia `DATABASE_URL_UNPOOLED` desde **Settings → Environment Variables → Reveal** y pégala
en un archivo `.env.local` con el formato `DATABASE_URL_UNPOOLED=postgres://...`.

```bash
npx vercel link
npx vercel env pull .env.local --environment=production
```

Aplica las migraciones y crea los usuarios:

```bash
npm run db:migrate
npm run db:seed
```

El seed imprime **una sola vez** la contraseña temporal de cada usuario. **Apúntalas en ese momento**: no se guardan en
ningún sitio. Cada persona tendrá que cambiarla en su primer inicio de sesión. Si pierdes alguna, el administrador puede
restablecerla en *Ajustes → Usuarios y contraseñas*.

Cuando termines, borra el archivo local con credenciales: `rm .env.local`.

> El seed es idempotente: si lo ejecutas otra vez no toca a los usuarios que ya existen ni duplica la sección de ejemplo.

## 6. Primer arranque

1. Abre la URL de producción. Verás la pantalla *Cuentas Claras* con los campos **Usuario** y **Contraseña**.
2. Entra como `javi` con su contraseña temporal. La app te lleva a *Cambiar contraseña*: elige una nueva (mínimo 10 caracteres).
3. Ya en *Inicio* verás tu saldo y la sección **Arepas casa Javi**, donde los otros cuatro te deben 4,50 € cada uno.
4. Para cargar otras deudas que ya existan: **Ajustes → Deudas iniciales**.
5. Instálala en el móvil: Android (Chrome) menú ⋮ → *Instalar aplicación*; iPhone (Safari) Compartir → *Añadir a la pantalla de inicio*.

## 7. Checklist de verificación tras desplegar

- [ ] La URL de producción carga con HTTPS y muestra la pantalla de inicio de sesión.
- [ ] Entrar sin sesión a `/`, `/gastos` o `/secciones` redirige a `/login`.
- [ ] Una contraseña incorrecta muestra «Usuario o contraseña incorrectos»; tras 5 fallos seguidos aparece «Demasiados intentos fallidos».
- [ ] El inicio de sesión con la contraseña temporal obliga a cambiarla antes de ver nada más.
- [ ] No existe registro público: `/api/auth/sign-up/email` no crea usuarios (devuelve redirección a `/login` o 404).
- [ ] Un **miembro** no puede abrir `/admin/usuarios` ni `/admin/deudas-iniciales` (vuelve al inicio) y no ve botones de editar/borrar en gastos ajenos.
- [ ] Como admin: crear un usuario muestra su contraseña temporal una sola vez; restablecer la de otro la regenera.
- [ ] Añadir un gasto en menos de 30 segundos (título, importe, guardar). El saldo de la sección se actualiza.
- [ ] Probar los cuatro repartos (iguales, exactos, %, partes) y comprobar que la suma de las partes es exacta.
- [ ] «Ya he pagado» reduce el saldo y el pago aparece en el historial.
- [ ] Borrar un gasto lo quita de los saldos pero sigue visible en *Actividad* (borrado lógico).
- [ ] El tema oscuro es el predeterminado y el botón de tema cambia al claro.
- [ ] `https://TU-DOMINIO/manifest.webmanifest` responde 200 y el navegador ofrece instalar la app.
- [ ] En **Vercel → Logs** no hay errores 500 y en *Storage → Neon* aparecen las tablas (`user`, `sections`, `expenses`…).
- [ ] El repositorio no contiene `.env`, contraseñas ni la cadena de conexión.

## Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| Error 500 al entrar y en los logs `relation "user" does not exist` | No se han aplicado las migraciones. Ejecuta `npm run db:migrate` (paso 5). |
| «Falta la variable de entorno DATABASE_URL» | La integración de Neon no está conectada al entorno actual. Revisa *Storage* y las variables (paso 3). |
| El inicio de sesión no se mantiene / vuelve al login | `BETTER_AUTH_URL` no coincide con el dominio real, o falta `BETTER_AUTH_SECRET`. Corrígelos y haz *Redeploy*. |
| `npm run db:migrate` no encuentra la base de datos | No existe `.env.local` con `DATABASE_URL_UNPOOLED` o `DATABASE_URL` (paso 5). |
| Los despliegues *Preview* no dejan entrar | Las variables deben estar marcadas también para *Preview*, y `BETTER_AUTH_URL` debe ser válida para esa URL. |
