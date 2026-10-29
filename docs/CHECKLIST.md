# Checklist · lo que falta cargar

Todo va en **Vercel → speak-sellers-dashboard → Settings → Environment Variables**
(Production y Preview). Después de agregar variables: **Deployments → ··· → Redeploy**.

## Ya cargado
- [x] `ADMIN_EMAILS`, `CRON_SECRET`, `CARGA_API_TOKEN`
- [x] Supabase (lo cargó la integración sola)
- [x] Login con Google (Google Cloud + Supabase)

## 1. Marcos
- [ ] `LECTOR_EMAILS` = el email de Google de Marcos

## 2. GoHighLevel → agendas, estados, leads (todos los días, solo)
En GHL, sub-cuenta **LANZA SELLING LLC** → **Settings → Private Integrations → Create new integration**
- Nombre: `Speak Sellers Dashboard`
- Permisos (solo lectura): `calendars.readonly`, `calendars/events.readonly`, `contacts.readonly`,
  `opportunities.readonly`, `conversations.readonly`, `conversations/message.readonly`, `locations.readonly`
- Copiar el token (empieza con `pit-`)
- [ ] `GHL_TOKEN` = ese token
- [ ] `GHL_LOCATION_ID` = `qcLzgJ0LSGXkHKb4pkHn`

## 3. Meta → anuncios e Instagram orgánico (todos los días, solo)
Necesita un token de **usuario del sistema** (no vence; uno personal vence a los 60 días).
1. <https://developers.facebook.com/apps> → si no hay app: **Crear app** → tipo **Empresa** → asociarla al Business `1943109262395693`.
2. <https://business.facebook.com/settings/system-users> → **Agregar** → nombre `speak-sellers-dashboard`, rol **Empleado**.
3. **Asignar activos** al usuario del sistema: cuenta publicitaria `act_1431751731204204` (ver rendimiento), página de Facebook de Marcos, Instagram `marcoslanci`.
4. **Generar token** → elegir la app → caducidad **Nunca** → permisos:
   `ads_read`, `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`, `business_management`.
- [ ] `META_TOKEN` = ese token
- [ ] `META_AD_ACCOUNT` = `act_1431751731204204`
- [ ] `IG_USER_ID`: no hace falta, se saca solo de `META_PAGE_ID` (1696198744016068 es la página "Marcos Lanci": va en `META_PAGE_ID`)

## 4. Que Claude pueda verificar y cargar datos
En Claude Code → menú del entorno (barra de título de la sesión) → **Edit → Network access** → **Allowed domains**, agregar:
- [ ] `speak-sellers-dashboard.vercel.app`
- [ ] `vzfxzmbmwqlkgkyangua.supabase.co`

(Dejar tildado "Allow package managers".) Con eso Claude prueba el sitio, corre el cron a mano y carga la migración.

## 4a. Tiempo de respuesta del setter (DMs de Instagram)
- [ ] `META_PAGE_ID` en Vercel = ID de la página de Facebook conectada al Instagram (Meta Business Suite → Configuración → Páginas)
- [ ] El `META_TOKEN` (usuario de sistema) necesita los permisos `instagram_manage_messages`, `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata` y `business_management`, con la página y la cuenta de Instagram asignadas como activos
- [ ] En la app de Instagram: Configuración → Mensajes → Herramientas conectadas → "Permitir acceso a los mensajes" activado

## 4b. Resumen semanal por mail (viernes 18:00 AR)
- [ ] Crear cuenta en resend.com con `joaquin@salesspawn.com` → API Keys → Create (permiso "Sending access")
- [ ] En Vercel → Settings → Environment Variables: `RESEND_API_KEY` = esa key
- [ ] `RESUMEN_EMAILS` = `joaquin@salesspawn.com` (sin dominio verificado, Resend solo manda al dueño de la cuenta)
- [ ] Para mandarlo a más gente: verificar `salesspawn.com` en Resend → Domains, y poner `RESUMEN_DESDE=Speak Sellers <resumen@salesspawn.com>`
- [ ] Redeploy y probar con "Mandarme una prueba" en `/resumen`

## 5. Datos que tiene que pasar Joaco
- [ ] Metas del mes (se cargan en Inicio → Meta del mes)
- [ ] Lista de softwares que pagan y cuánto (o cargarlos en `/costos`)
- [ ] Cotización o USD exactos de los pagos en ARS (Martín, Damián, Cristian)
- [ ] OK para migrar el spreadsheet "Dashboard - Speak Sellers" (Claude lo lee desde Google Drive)

## Después (lo hace Claude)
- Migración del histórico del spreadsheet
- Primera corrida del cron con GHL + Meta y revisión de números
- Agente diario de Claude (tarea programada 08:00 AR)
- Funnels por fuente: Lead magnet, Follow Me Ads, Orgánico, Webinar
- Rotar `CRON_SECRET` y `CARGA_API_TOKEN` (se pasaron por chat)
