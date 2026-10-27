# Puesta en marcha · Speak Sellers Dashboard

Son 4 pasos, unos 15 minutos. Todo lo demás (tablas, seguridad, usuarios) lo hace el código solo en cada deploy.

## 1. Vercel: importar el repo

1. Entrá a <https://vercel.com/new> con la cuenta del equipo **Sales Spawn LLC**.
2. Elegí **Import Git Repository** → `Joacolope/speak-sellers-dashboard` → **Deploy**.
   El primer deploy queda bloqueado en la pantalla de login con "no está conectada a la base de datos": es lo esperado.

## 2. Supabase: crear la base desde Vercel (se conecta sola)

1. En el proyecto de Vercel: **Storage** → **Create Database** → **Supabase** → plan **Free**, región **São Paulo (gru1)** o **US East**.
2. **Connect Project** → elegí `speak-sellers-dashboard`, entornos Production y Preview.
   Esto carga solas las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `POSTGRES_URL_NON_POOLING`.

## 3. Variables que faltan (Vercel → Settings → Environment Variables)

| Variable | Valor |
|---|---|
| `ADMIN_EMAILS` | Los emails de Google de los admins, separados por coma. Ej.: `joaquin@salesspawn.com,joacolope609@gmail.com` |
| `LECTOR_EMAILS` | Quienes solo miran. Ej.: el email de Marcos |
| `EDITOR_EMAILS` | (opcional) Quienes cargan datos pero no son admin |
| `CRON_SECRET` | Un texto aleatorio de 40+ caracteres (ver abajo) |
| `CARGA_API_TOKEN` | Otro texto aleatorio de 40+ caracteres, para que Claude cargue datos |

Para generar los secretos, en cualquier terminal: `openssl rand -hex 32` (una vez por cada uno).

Después: **Deployments** → los tres puntos del último → **Redeploy**. En el log del build tiene que aparecer
`[db-setup] Schema aplicado. Usuarios activos: N.`

## 4. Login con Google

**a) Google Cloud (crear la credencial)**

1. <https://console.cloud.google.com/apis/credentials> → crear proyecto `speak-sellers-dashboard` si no hay uno.
2. **OAuth consent screen** → tipo **External** → nombre "Speak Sellers Dashboard", tu email de soporte → guardar.
   En **Audience**, publicá la app (o agregá los emails como test users).
3. **Credentials** → **Create credentials** → **OAuth client ID** → **Web application**.
4. En **Authorized redirect URIs** pegá la URL que muestra Supabase en el paso b (termina en `/auth/v1/callback`).
5. Copiá el **Client ID** y el **Client secret**.

**b) Supabase (activar Google)**

1. Dashboard de Supabase → **Authentication** → **Sign In / Providers** → **Google** → activar.
2. Pegá Client ID y Client secret → guardar. Ahí mismo está la *Callback URL* para el paso a.4.
3. **Authentication** → **URL Configuration**:
   - **Site URL**: `https://speak-sellers-dashboard.vercel.app`
   - **Redirect URLs**: `https://speak-sellers-dashboard.vercel.app/auth/callback`
4. **Authentication** → **Sign In / Providers** → desactivá **Email** (solo se entra con Google).

Listo: entrá a la URL, **Entrar con Google** con un email de `ADMIN_EMAILS`.

## Después

- **Agregar o sacar gente**: sumá el email a `ADMIN_EMAILS` / `EDITOR_EMAILS` / `LECTOR_EMAILS` y redeployá, o editá la tabla `usuarios` en Supabase (`activo = false` para sacar a alguien; el script nunca baja roles ni borra).
- **Datos reales**: cargar `GHL_TOKEN`, `META_TOKEN` (ver `.env.example`) para que el cron diario traiga GHL, Meta Ads e Instagram.
- **Migración del spreadsheet**: `npm run migrar` (ver `scripts/migrar.ts`).

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
| Cron y Claude | Token secreto de 32+ caracteres, comparado en tiempo constante. |
| Encabezados | CSP, HSTS, anti-iframe, nosniff, sin `X-Powered-By`. |
| Validación | Cada campo editable se valida (tipo, rango, valores permitidos). Los errores de base no se muestran al cliente. |
| Auditoría | Cada carga manual guarda quién la hizo (`editado_por`). |
