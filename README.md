# Dashboard de ventas para negocios con closers

Plataforma web que reemplaza la planilla de métricas comerciales de un negocio de high ticket (coach, mentor, infoproductor con setters y closers) y se actualiza sola todos los días desde GoHighLevel, Meta Ads e Instagram.

Este repo es una **plantilla**: funciona para un cliente (hoy, Speak Sellers) y se replica para otro cambiando un solo archivo, `cliente.json`.

## Montarlo para un cliente nuevo

1. Creá un repo desde esta plantilla.
2. Editá **`cliente.json`**: marca, closers, zona horaria, objetivos, IDs de GHL y Meta (`docs/cliente.schema.json` explica cada campo; `docs/cliente.ejemplo.json` es un punto de partida).
3. Seguí **`docs/PUESTA_EN_MARCHA.md`** (Vercel + Supabase + Google, ~40 min). Lo que tiene que entregar el cliente está en **`docs/ACCESOS_CLIENTE.md`**.
4. En **`/conexiones`** (solo admin) se ve en vivo qué quedó conectado y qué falta, con el paso para arreglarlo.

Con Claude Code: la skill **`/nuevo-cliente`** (`.claude/skills/nuevo-cliente/`) lleva todo el onboarding de la mano.

Nada del cliente vive en el código: los secretos van en variables de entorno de Vercel (`.env.example`) y los IDs en `cliente.json`.

## Qué hace

| Ruta | Qué muestra |
|---|---|
| `/` | Inicio: alertas del día, 6 tarjetas, embudo por fuente, metas del mes, gráficos |
| `/closers` | Agendas y resultados por closer (celdas editables) |
| `/setter` | Conversaciones, agendas y tiempo de respuesta en DMs |
| `/cobranzas` | Cobros, cuotas pendientes, reembolsos |
| `/metricas` | Tabla mensual con semáforos |
| `/puntos-de-contacto` | Por dónde llegó cada lead (UTMs y primer contacto) |
| `/anuncios` | Inversión, costo por resultado, campañas activas |
| `/organico` | Reels e historias: views, comentarios, seguidores por reel, ventas por video |
| `/costos` | Software, comisiones de closers y de plataformas de cobro |
| `/resumen` | La semana comparada con la anterior |
| `/cargar` | Formulario manual (venta, cobro, asistencia, webinar) |
| `/conexiones` | Estado de cada integración (admin) |

Filtro global por mes, closer y fuente en la URL. Modo oscuro/claro.

## Cómo se actualiza

- **Cron diario** (`/api/cron/diario`, horario en `vercel.json` en UTC): agendas y leads de GHL, inversión y campañas de Meta, reels/historias/seguidores de Instagram.
- **Webhook de GHL**: cada cita nueva, confirmada o cancelada entra al instante.
- **Cargas manuales**: desde `/cargar` o dictándole a Claude (`docs/CARGA_POR_CLAUDE.md`). Lo manual nunca lo pisa el cron.

Origen de cada número: ● automático · ◐ agente · ○ manual o migración.

## Fórmulas

- `Facturación` = valor de lo vendido en el período, con las cuotas por cobrar.
- `Cash Collected` = lo que entró: ventas nuevas + cuotas cobradas − reembolsos.
- `Ganancia = Cash Collected − inversión en ads − software del mes − comisiones de closers − comisiones de plataformas`. El margen se calcula sobre el Cash Collected.
- Venta = compró. Las señas no cuentan como venta, pero su plata sí cuenta como cobrada.
- % cierre s/ no-show = ventas / (agendas − no-shows); % cierre / presentadas = ventas / llamadas presentadas.
- Conversaciones = inbound (orgánicas + pagadas) + outbound con respuesta. Es el primer nivel del embudo por fuente; el embudo general arranca en Agendas.
- Embudos por fuente: **Orgánico** (incluye las campañas que llevan al perfil), **Webinar**, **YouTube**.

## Stack

Next.js 14 (App Router) · Tailwind v4 · Recharts · Supabase (Postgres) · Vercel (hosting + cron). Todo en plan gratuito.

```bash
npm install
cp .env.example .env.local   # sin Supabase corre con datos de ejemplo
npm run dev
```

## Diseño

Los dashboards siguen `DESIGN_dashboards.md` (papel cálido, 95 % acromático, acento naranja Ember + bronce Brass, títulos Inter Tight 400, tarjetas blancas, navegación en píldora). Los componentes usan solo variables semánticas (`--bg`, `--surface`, `--accent`, …) de `app/globals.css`. Verde y rojo solo para semáforos y variaciones.

## Acceso y seguridad

Login solo con Google. Entra quien esté en la tabla `usuarios` (se carga desde `ADMIN_EMAILS`, `EDITOR_EMAILS`, `LECTOR_EMAILS`). Admin y editor cargan datos; lector solo mira. Detalle de todas las capas al final de `docs/PUESTA_EN_MARCHA.md`.

## Estructura

```
cliente.json              ← todo lo que cambia por cliente
lib/cliente.ts            ← lo tipa y lo expone (TITULO, CLOSERS, OBJETIVOS, ids…)
lib/sync/                 ← GHL, Meta, Instagram
supabase/schema.sql       ← tablas, vistas, RLS (idempotente; db-setup lo aplica en cada build)
supabase/migraciones/     ← cambios de schema posteriores
scripts/db-setup.mjs      ← valida cliente.json, aplica schema, carga usuarios y comisiones iniciales
docs/                     ← puesta en marcha, accesos del cliente, schema de la config
docs/clientes/            ← material propio de cada cliente (spec, checklist)
.claude/skills/           ← /nuevo-cliente
```
