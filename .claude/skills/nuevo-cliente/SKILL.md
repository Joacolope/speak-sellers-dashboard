---
name: nuevo-cliente
description: Monta este dashboard de ventas para un cliente nuevo (coach, mentor, infoproductor con closers) a partir de la plantilla. Usala cuando digan "nuevo cliente", "montar el dashboard para X", "onboarding de X", "replicar el dashboard", "copiar el dashboard de Speak Sellers para otro". Lleva de la mano desde las preguntas hasta el dashboard publicado y conectado a GoHighLevel, Meta e Instagram.
---

# Nuevo cliente · montar el dashboard

Esta plantilla ya funciona para Speak Sellers. Para otro cliente **no se reescribe nada**: se copia el repo,
se cambia `cliente.json`, se despliega en Vercel con Supabase y se conectan GHL, Meta e Instagram.
Son ~40 minutos de trabajo activo si el cliente ya pasó los accesos (ver `docs/ACCESOS_CLIENTE.md`).

Hablá siempre en rioplatense, corto. Nunca pegues tokens en el chat ni en commits: van directo a las
variables de entorno de Vercel. Si un token llegó por chat, pedí rotarlo al terminar.

## 0. Antes de empezar

1. Confirmá que estás parado en el repo de la plantilla (`cliente.json` y `docs/cliente.schema.json` existen).
2. Preguntá **dónde se va a hospedar**: cuenta de Vercel (equipo) y cuenta de GitHub donde crear el repo nuevo.
3. Pedí los accesos del cliente si no los tenés. Lo mínimo para arrancar: nombre de la marca y lista de closers.
   El resto (GHL, Meta) se puede conectar después desde **/conexiones**.

## 1. Las preguntas (una sola vez, todas juntas)

Hacé estas preguntas en un solo mensaje. Con las respuestas se arma `cliente.json`.

| # | Pregunta | Campo |
|---|---|---|
| 1 | ¿Cómo se llama la marca? ¿Razón social (si la hay)? | `nombre`, `empresa` |
| 2 | ¿Cómo se llama el producto que venden? (default del campo Producto) | `producto` |
| 3 | ¿Quiénes toman llamadas? Nombre corto + nombre completo. ¿Alguno ya no closea? ¿% de comisión de cada uno sobre lo cobrado? | `closers[]` (`id`, `nombre`, `activo`, `comisionInicial`) |
| 4 | ¿Zona horaria del negocio? (ej.: Argentina, México, España) | `zonaHoraria` (IANA) |
| 5 | ¿Objetivo de % de asistencia y % de cierre para que esté en verde? (si no saben: 60 % y 30 %) | `objetivos` |
| 6 | ¿Usan GoHighLevel? ¿Nombre de la sub-cuenta? ¿Calendario(s) de llamadas de venta? ¿Pipeline comercial? | `ghl.*` |
| 7 | ¿Corren anuncios en Meta? ¿Cuenta publicitaria? ¿Cómo se llaman las campañas que llevan al perfil (tipo "Follow Me") y las de webinar? | `meta.cuentaPublicitaria`, `meta.campanas` |
| 8 | ¿Instagram del negocio y página de Facebook conectada? | `meta.instagram`, `meta.paginaId` |
| 9 | ¿Qué preguntas tiene el formulario de agenda? (closer en actividad, comisiones, nicho, dato previo, "qué video te hizo seguirnos") | `formulario` (solo si los nombres difieren) |
| 10 | ¿Emails de Google de quién administra, quién carga datos y quién solo mira? | env `ADMIN_EMAILS` / `EDITOR_EMAILS` / `LECTOR_EMAILS` |
| 11 | ¿Email de contacto para Privacidad/Términos? | `contacto` |

Los IDs de GHL (sub-cuenta, calendarios, pipeline, usuarios) se pueden **descubrir** con el MCP de GHL
(`list_locations`, `search_operations` → calendarios / pipelines / users) en vez de pedirlos. Si no hay IDs de
calendarios ni pipeline, dejalos vacíos: el sync usa todos los calendarios y el primer pipeline.

## 2. Crear el repo del cliente

```bash
# desde la cuenta de GitHub elegida; el nombre: <marca>-dashboard en minúsculas
gh repo create <org>/<marca>-dashboard --private --template Joacolope/speak-sellers-dashboard --clone
cd <marca>-dashboard
```

Si "Use this template" no está habilitado en el repo fuente, cloná y empujá a un repo nuevo vacío
(sin el historial de Speak Sellers: `git checkout --orphan main && git commit -m "Dashboard <marca>"`).

Después, en el repo nuevo:

1. Escribí `cliente.json` con las respuestas (respetá `docs/cliente.schema.json`; podés arrancar de `docs/cliente.ejemplo.json`).
   Sacá `googleSiteVerification` (es de Speak Sellers) hasta tener el del cliente.
2. Borrá lo que es solo de Speak Sellers: `docs/clientes/speak-sellers/`, `public/google*.html`, `scripts/migrar.ts` si no van a migrar un spreadsheet.
3. `vercel.json`: el cron diario está en `0 9 * * *` UTC (= 6:00 Argentina). Ajustalo a las ~6:00 de la zona horaria del cliente
   (México: `0 12 * * *`, España: `0 5 * * *`).
4. `node scripts/db-setup.mjs` sin base tiene que imprimir `Cliente: <marca> · N closer(s)`. Si falla, dice qué falta.
5. `npm install && npx tsc --noEmit && npm run dev` → entrá a `/`, `/closers`, `/conexiones` con datos de ejemplo. Sacá una captura.
6. Commit y push a `main`.

## 3. Vercel + Supabase

Con el MCP de Vercel (o la UI):

1. `create_git_project` con el repo nuevo (framework Next.js). Primer deploy: queda en el login diciendo "no está conectada a la base": es lo esperado.
2. **Supabase**: Vercel → proyecto → Storage → Create Database → Supabase (Free, región más cercana) → Connect Project (Production y Preview).
   Esto carga solas `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`. No hay MCP para este paso: es un clic en la UI.
3. Variables (`create_project_env`, target production + preview, tipo sensitive para los secretos):
   - `ADMIN_EMAILS`, `EDITOR_EMAILS`, `LECTOR_EMAILS`
   - `CRON_SECRET` y `CARGA_API_TOKEN`: generalos con `openssl rand -hex 32` **cada uno distinto**. Guardalos vos (el de carga lo vas a usar para verificar); no los pegues en el chat.
   - `GHL_TOKEN`, `GHL_WEBHOOK_SECRET` (otro `openssl rand -hex 32`), `META_TOKEN`, `MANYCHAT_TOKEN` a medida que los tengas.
4. Redeploy. En el log del build tiene que decir `[db-setup] Cliente: <marca>` y `[db-setup] Schema aplicado. Usuarios activos: N`.
5. **Login con Google**: seguir el paso 4 de `docs/PUESTA_EN_MARCHA.md` (Google Cloud → credencial OAuth, Supabase → Providers → Google, URL Configuration con el dominio de Vercel). Es manual, 10 minutos.
6. Pedile al cliente que entre con su Google. Si ve el dashboard vacío, el login anda.

## 4. Conectar las fuentes

Después de cada paso, abrí **`/conexiones`** (admin) y confirmá que la fila quedó en verde.

**GoHighLevel**
- El cliente crea una Private Integration (ver `docs/ACCESOS_CLIENTE.md`) y te pasa el token → `GHL_TOKEN`.
- Si el formulario de agenda no tiene la pregunta **"¿Qué video nuestro te hizo seguirnos?"**, creala con el MCP de GHL
  (`locations.create-custom-field`, `dataType: LARGE_TEXT`, `model: contact`) y pedile al cliente que la agregue al formulario del calendario como obligatoria.
  Lo mismo con "¿Sos closer en actividad?", "¿Cuánto comisionás por mes?" y "¿En qué nicho?" si quieren la cualificación.
- Webhook de citas: `GHL_WEBHOOK_SECRET` en Vercel; en GHL un workflow con disparador Cita → Webhook POST a `https://<dominio>/api/webhooks/ghl?token=<secreto>`.

**Meta Ads e Instagram**
- Token de **usuario del sistema** (no vence) con la cuenta publicitaria, la página y el Instagram asignados (pasos exactos en `docs/ACCESOS_CLIENTE.md`) → `META_TOKEN`.
- `meta.cuentaPublicitaria` y `meta.paginaId` ya están en `cliente.json`; si el cliente los cambia, redeploy.
- Los nombres de campaña tienen que contener los textos de `meta.campanas` (por ejemplo "follow me"); si no, no se cuentan. Revisalo con el cliente.

**Primer sync**
```bash
curl -s -H "Authorization: Bearer $CARGA_API_TOKEN" "https://<dominio>/api/cron/diario" | jq .
```
Tiene que devolver `ok: true` con GHL, Meta, Campañas e IG. Si una fuente falla, el mensaje dice qué.

## 5. Entregar

1. Capturas de `/`, `/closers`, `/anuncios` y `/conexiones` con datos reales (con Playwright o a mano) para mandarle al cliente.
2. Cargar con el cliente, desde el dashboard: metas del mes (Inicio → Meta del mes), costos de software (`/costos`) y comisiones si cambiaron.
3. Explicarle en 3 líneas: todo se actualiza solo a la mañana; ventas y cobros se cargan en **Cargar** (o se le dictan a Claude);
   en **/conexiones** se ve si algo se desconectó (por ejemplo, un token vencido).
4. Rotar cualquier secreto que haya pasado por chat.

## Si algo no cuadra

- `cliente.json inválido`: el mensaje dice el campo. `docs/cliente.schema.json` tiene todos.
- Agendas sin closer correcto: faltan `ghlUserId` / `ghlCalendarId` en los closers. Los IDs salen del MCP de GHL (users / calendars de la sub-cuenta).
- Anuncios en cero: los nombres de campaña no contienen `meta.campanas`, o el token no tiene `ads_read` sobre esa cuenta.
- Instagram en error: la página de `meta.paginaId` no tiene un Instagram profesional conectado, o faltan `instagram_basic` / `instagram_manage_insights`.
- Costo por seguidor en "—": Meta no informa seguidores por la API para campañas de mensajes; es normal.
