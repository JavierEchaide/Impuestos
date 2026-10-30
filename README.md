# Cuentas Claras

Aplicación web (PWA) para **dividir gastos entre amigos** y ver cuánto debe cada persona a las demás.
Pensada para usarse sobre todo desde el móvil, en español y en euros.

- Gastos con cuatro tipos de reparto: **a partes iguales, importes exactos, porcentajes y participaciones**.
- **Secciones**: cuentas con nombre dentro del grupo («Piso», «Viaje a Lisboa», «Arepas casa Javi»…), cada una con sus saldos y sus pagos.
- Saldos por persona y vista de **quién paga a quién**, alternando entre deudas **simplificadas** (mínimo de transferencias) y **directas**.
- Botón **«Ya he pagado»**, historial de actividad, comentarios en cada gasto, categorías, filtros y búsqueda.
- Tema **Gruvbox** (oscuro por defecto, con opción de claro) e instalable en el móvil.

## Stack

| Pieza | Elección |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Estilos | Tailwind CSS 4 + componentes estilo shadcn/ui (en `src/components/ui`) |
| Base de datos | Postgres (Neon desde el Marketplace de Vercel) |
| ORM | **Drizzle** — ligero, sin binarios nativos ni paso de generación, migraciones SQL claras y arranque rápido en serverless |
| Autenticación | **Better Auth** — usuario + contraseña, sesión en cookie `httpOnly`; Auth.js ya solo recibe mantenimiento |
| Contraseñas | Argon2id (`@node-rs/argon2`, parámetros mínimos de OWASP) |
| Validación | Zod, con los mismos esquemas en cliente y servidor |
| Tests | Vitest |

## Cómo arrancarla en local

Requisitos: Node.js 22+ y un Postgres (local o un proyecto de Neon).

```bash
npm install
cp .env.example .env     # y rellena los valores (ver más abajo)
npm run db:migrate       # crea las tablas
npm run db:seed          # crea los 5 perfiles y la sección de ejemplo
npm run dev              # http://localhost:3000
```

El seed imprime **una sola vez** una contraseña temporal aleatoria por usuario nuevo. No se guarda en ningún
fichero (solo su hash en la base de datos). Cada persona debe cambiarla en su primer inicio de sesión. El seed es
idempotente: volver a ejecutarlo no toca a los usuarios que ya existen.

Perfiles que crea: **Javi** (administrador), **Cristian**, **Amy**, **Paula** y **Pablo** (miembros). También crea la
sección «Arepas casa Javi», en la que Javi es el receptor y los otros cuatro deben 4,50 € cada uno.

### Postgres en local

Con Docker:

```bash
docker run --name cuentas-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cuentas -p 5432:5432 -d postgres:16
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/cuentas
```

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a Postgres. Con la integración de Neon en Vercel se inyecta sola. |
| `DATABASE_URL_UNPOOLED` | Opcional. Conexión directa (sin pooler) que usan las migraciones; si falta se usa `DATABASE_URL`. |
| `BETTER_AUTH_SECRET` | Secreto de la autenticación, mínimo 32 caracteres. Genéralo con `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | URL pública de la app (`http://localhost:3000` en local, tu dominio de Vercel en producción). |

El archivo `.env` está en `.gitignore`: **nunca se sube al repositorio**. Solo se versiona `.env.example`, sin valores.

## Cómo añadir usuarios

No hay registro público: **solo el administrador crea usuarios**.

1. Inicia sesión como administrador y ve a **Ajustes → Usuarios y contraseñas**.
2. **Nuevo usuario**: nombre, nombre de usuario y rol. La app muestra una contraseña temporal **una sola vez**.
3. Pásasela a esa persona: tendrá que cambiarla al entrar.

Desde la misma pantalla puedes **restablecer la contraseña** (genera otra temporal y cierra sus sesiones) o
**desactivar** a alguien (no puede entrar, pero su historial y sus saldos se conservan).

Las deudas que ya existen hoy se cargan en **Ajustes → Deudas iniciales** (ver más abajo).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo, compilación y servidor de producción |
| `npm test` | Tests unitarios (Vitest) |
| `npm run typecheck` / `npm run lint` | Comprobación de tipos y ESLint |
| `npm run db:generate` | Genera una migración SQL a partir de `src/lib/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones de `drizzle/` |
| `npm run db:seed` | Crea los perfiles y la sección de ejemplo (idempotente) |

## Cómo funciona el dinero

Todo el cálculo vive en `src/lib/money` y no depende de la base de datos ni de React.

- Los importes son **enteros en céntimos**, nunca `float`. Al escribir «12,50» se convierte a `1250` sin pasar por decimales.
- Los cuatro repartos usan el **método del mayor resto** sobre pesos enteros. Los céntimos sobrantes se asignan de forma
  determinista (la semilla es el id del gasto, así que no recae siempre en la misma persona) y la suma de las partes es
  **exactamente** el total.
- Saldo neto de cada persona = lo que ha pagado − lo que le corresponde. **La suma de todos los saldos es siempre 0.**
- Un pago de A a B se calcula como un gasto pagado por A y repartido al 100 % a B.
- **Simplificar deudas**: se empareja al mayor acreedor con el mayor deudor hasta saldar todo (como mucho n−1 transferencias).
  La vista **directa** netea solo entre cada pareja de personas.
- **Deudas iniciales** = gastos normales con categoría «Deuda inicial», pagados por el acreedor y repartidos al 100 % al
  deudor, así que entran en el mismo cálculo que cualquier otro gasto.
- Los gastos y pagos se **borran de forma lógica** (`deleted_at`): dejan de contar en los saldos pero quedan en el historial.

## Permisos

| | Miembro | Administrador |
| --- | --- | --- |
| Ver gastos, saldos y secciones | Sí | Sí |
| Añadir gastos, pagos, comentarios y secciones | Sí | Sí |
| Editar o borrar gastos | Solo los suyos | Cualquiera |
| Registrar un pago | Si es el pagador o el receptor | Cualquiera |
| Editar o archivar una sección | Solo las suyas | Cualquiera |
| Deudas iniciales, usuarios y contraseñas | No | Sí |
| Historial | Gastos, pagos, comentarios y secciones | Completo, con detalle y gestión de usuarios |

La autorización se comprueba **en el servidor** en cada acción (`src/lib/actions`), no solo ocultando botones.

## Seguridad

- Contraseñas con **Argon2id**; sesión en cookie `httpOnly`, `Secure` y `SameSite=Lax` en producción.
- **No hay registro público ni endpoints HTTP de autenticación**: Better Auth solo se usa desde acciones del servidor.
- **Límite de intentos** de inicio de sesión: 5 fallos por usuario y 20 por IP en 15 minutos bloquean 15 minutos.
- Validación con **Zod** en cliente y en servidor. Cambio de contraseña obligatorio con la temporal.
- Cabeceras de seguridad (`X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`).
- `proxy.ts` redirige al login si no hay cookie, pero es solo una comprobación optimista: cada página y cada acción vuelven a validar la sesión.
- El service worker **no cachea** páginas ni datos con sesión.

## PWA

Incluye `manifest.webmanifest`, iconos (incluido uno *maskable*), un service worker básico y una página sin conexión.
En Android (Chrome): menú ⋮ → «Instalar aplicación». En iPhone (Safari): Compartir → «Añadir a la pantalla de inicio».
Los iconos se regeneran con `node scripts/make-icons.mjs`.

## Despliegue

Consulta [`DEPLOY.md`](./DEPLOY.md): guía paso a paso para subir el proyecto a GitHub, importarlo en Vercel, añadir
Neon, configurar variables, migrar, sembrar y comprobar que todo funciona.

## Estructura

```
src/
  app/                 rutas (App Router): (auth) login y cambio de contraseña, (app) resto
  components/          UI (ui/ = primitivas estilo shadcn) y componentes de cada pantalla
  lib/
    money/             dominio del dinero (puro, con tests)
    db/                esquema Drizzle y cliente
    auth/              Better Auth, sesión, límite de intentos
    actions/           server actions con Zod y autorización
    queries/           lecturas
    validation/        esquemas Zod compartidos
drizzle/               migraciones SQL
scripts/               migrate, seed, iconos
```

## Ideas para una fase 2

Exportar a CSV, gastos recurrentes, notificaciones push, fotos de tickets, recordatorios de pago y grupos/viajes
separados con miembros propios. No están implementadas en esta versión.
