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
- [ ] `IG_USER_ID` = `1696198744016068` (Claude lo verifica con el token)

## 4. Que Claude pueda verificar y cargar datos
En Claude Code → menú del entorno (barra de título de la sesión) → **Edit → Network access** → **Allowed domains**, agregar:
- [ ] `speak-sellers-dashboard.vercel.app`
- [ ] `vzfxzmbmwqlkgkyangua.supabase.co`

(Dejar tildado "Allow package managers".) Con eso Claude prueba el sitio, corre el cron a mano y carga la migración.

## 5. Datos que tiene que pasar Joaco
- [ ] Lista de softwares que pagan y cuánto (o cargarlos en `/costos`)
- [ ] Cotización o USD exactos de los pagos en ARS (Martín, Damián, Cristian)
- [ ] OK para migrar el spreadsheet "Dashboard - Speak Sellers" (Claude lo lee desde Google Drive)

## Después (lo hace Claude)
- Migración del histórico del spreadsheet
- Primera corrida del cron con GHL + Meta y revisión de números
- Agente diario de Claude (tarea programada 08:00 AR)
- Funnels por fuente: Lead magnet, Follow Me Ads, Orgánico, Webinar
- Rotar `CRON_SECRET` y `CARGA_API_TOKEN` (se pasaron por chat)
