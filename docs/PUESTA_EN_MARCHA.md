# Puesta en marcha

Cómo publicar el dashboard para un cliente. Son 5 pasos, unos 40 minutos. Todo lo demás (tablas, seguridad, usuarios, comisiones iniciales) lo hace el código solo en cada deploy.
Si trabajás con Claude Code, la skill **`/nuevo-cliente`** hace de guía paso a paso.

## 0. El repo del cliente

1. Creá un repo nuevo a partir de esta plantilla (GitHub → *Use this template*, o `gh repo create <org>/<marca>-dashboard --template <este repo>`).
2. Editá **`cliente.json`**: marca, closers, zona horaria, objetivos, IDs de GHL y Meta. Cada campo está explicado en `docs/cliente.schema.json`; hay un ejemplo en `docs/cliente.ejemplo.json`.
3. `vercel.json`: los crons están en UTC. El diario (`0 9 * * *`) es 6:00 de Argentina; ajustalo a la zona del cliente.
4. `node scripts/db-setup.mjs` tiene que imprimir `Cliente: <marca> · N closer(s)`. Después `npm run dev` y revisá `/` y `/closers` con datos de ejemplo.

## 1. Vercel: importar el repo

1. <https://vercel.com/new> con la cuenta del equipo → **Import Git Repository** → el repo del cliente → **Deploy**.
2. El primer deploy queda en la pantalla de login con "no está conectada a la base de datos": es lo esperado.

## 2. Supabase: crear la base desde Vercel (se conecta sola)

1. En el proyecto de Vercel: **Storage** → **Create Database** → **Supabase** → plan **Free**, región más cercana al cliente.
2. **Connect Project** → entornos Production y Preview.
   Esto carga solas `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `POSTGRES_URL_NON_POOLING`.

## 3. Variables (Vercel → Settings → Environment Variables)

| Variable | Valor |
|---|---|
| `ADMIN_EMAILS` | Emails de Google de quienes administran, separados por coma |
| `EDITOR_EMAILS` | Quienes cargan datos pero no administran |
| `LECTOR_EMAILS` | Quienes solo miran |
| `CRON_SECRET` | Texto aleatorio de 40+ caracteres (`openssl rand -hex 32`) |
| `CARGA_API_TOKEN` | Otro texto aleatorio distinto, para cargar datos por API (Claude, scripts) |
| `GHL_TOKEN` | Token de Private Integration de GoHighLevel (`pit-…`) |
| `GHL_WEBHOOK_SECRET` | Otro texto aleatorio: va en la URL del webhook de citas |
| `META_TOKEN` | Token de usuario del sistema de Meta |
| `RESEND_API_KEY`, `RESUMEN_EMAILS` | Para el resumen semanal por mail (opcional) |

Qué tiene que hacer el cliente para conseguir los tokens: **`docs/ACCESOS_CLIENTE.md`**.
Los IDs (sub-cuenta de GHL, cuenta publicitaria, página de Facebook) van en `cliente.json`, no acá.

Después: **Deployments** → los tres puntos del último → **Redeploy**. En el log del build tiene que aparecer
`[db-setup] Cliente: <marca>` y `[db-setup] Schema aplicado. Usuarios activos: N.`

## 4. Login con Google

**a) Google Cloud (crear la credencial)**

1. <https://console.cloud.google.com/apis/credentials> → crear un proyecto para el cliente.
2. **OAuth consent screen** → **External** → nombre "<Marca> Dashboard", tu email de soporte → guardar. En **Audience**, publicá la app (o agregá los emails como test users).
3. **Credentials** → **Create credentials** → **OAuth client ID** → **Web application**.
4. En **Authorized redirect URIs** pegá la *Callback URL* que muestra Supabase en el paso b (termina en `/auth/v1/callback`).
5. Copiá **Client ID** y **Client secret**.

**b) Supabase (activar Google)**

1. Dashboard de Supabase → **Authentication** → **Sign In / Providers** → **Google** → activar → pegar Client ID y secret.
2. **Authentication** → **URL Configuration**: **Site URL** = `https://<dominio>.vercel.app`; **Redirect URLs** = `https://<dominio>.vercel.app/auth/callback`.
3. **Sign In / Providers** → desactivar **Email** (solo se entra con Google).

Listo: entrá a la URL con un email de `ADMIN_EMAILS`.

## 5. Conectar y verificar

1. Abrí **`/conexiones`** (solo admin): cada integración aparece en verde o con el paso que falta.
2. Primer sync a mano: `curl -H "Authorization: Bearer $CARGA_API_TOKEN" https://<dominio>/api/cron/diario`. Tiene que devolver `ok: true`.
3. Webhook de citas en GHL: Automatizaciones → workflow con disparador **Cita** → acción **Webhook** POST a `https://<dominio>/api/webhooks/ghl?token=<GHL_WEBHOOK_SECRET>`.
4. Con el cliente: metas del mes (Inicio), costos (`/costos`) y comisiones si cambiaron.

## Después

- **Agregar o sacar gente**: sumá el email a `ADMIN_EMAILS` / `EDITOR_EMAILS` / `LECTOR_EMAILS` y redeployá, o editá la tabla `usuarios` en Supabase (`activo = false` para sacar a alguien; el script nunca baja roles ni borra).
- **Cambiar closers, objetivos o IDs**: editá `cliente.json` y hacé push. Un closer que se va: `"activo": false` (conserva su historial).
- **Migración de una planilla**: adaptá `scripts/migrar.ts` o cargá con `POST /api/cargar` (ver `docs/CARGA_POR_CLAUDE.md`).

## Qué protege la plataforma

| Capa | Qué hace |
|---|---|
| Login | Solo Google. Sin contraseñas propias que robar o adivinar. |
| Lista de acceso | Aunque alguien entre con Google, si su email no está en `usuarios` y activo, no ve nada. |
| Roles | `admin` y `editor` cargan datos; `lector` solo mira. Se verifica en el servidor en cada pedido. |
| Doble barrera | El middleware verifica sesión y lista; cada página y endpoint lo vuelve a verificar. |
| Base de datos | RLS forzado en todas las tablas. Anónimos: sin acceso. Logueados: solo lectura y solo si están en la lista. Escribir: solo el servidor. Vistas con `security_invoker`. |
| Claves | La service role de Supabase vive solo en el servidor. El navegador nunca recibe claves. |
| Cookies | `HttpOnly`, `Secure`, `SameSite=Lax`: JavaScript no las puede leer. |
| CSRF | Todo pedido que cambia datos tiene que venir del mismo sitio. |
| Cron y API | Token secreto de 32+ caracteres, comparado en tiempo constante. |
| Encabezados | CSP, HSTS, anti-iframe, nosniff, sin `X-Powered-By`. |
| Validación | Cada campo editable se valida (tipo, rango, valores permitidos). Los errores de base no se muestran al cliente. |
| Auditoría | Cada carga manual guarda quién la hizo (`editado_por`). |
