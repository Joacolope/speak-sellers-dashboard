# Speak Sellers Dashboard

Plataforma web que reemplaza el spreadsheet "Dashboard - Speak Sellers" y se actualiza sola todos los días.
Spec completa en `docs/speak-sellers-plataforma-spec.md`.

## Diseño

Los dashboards siguen `DESIGN_dashboards.md` (papel cálido, 95 % acromático, acento naranja Ember + bronce Brass, títulos Inter Tight a peso 400, tarjetas de datos blancas de 20px, botones rectos, navegación en píldora). Reemplaza a `DESIGN.md` para todo lo visual; `DESIGN.md` queda como referencia.

- Claro = Ventriloc tal cual. Oscuro = el mismo sistema en grafito cálido, mismos acentos. Toggle en la barra superior.
- Sin fondo cuadriculado. Gráficos simples: valores escritos sobre cada punto, dos colores, últimos 6 meses.
- Verde y rojo solo para semáforos y variaciones vs. mes anterior.
- Los componentes usan solo variables semánticas (`--bg`, `--surface`, `--accent`, …) definidas en `app/globals.css`.

## Costos

En `/costos` se carga cada herramienta (nombre, categoría, monto en USD, mensual / anual / pago único, desde cuándo). El software del mes se calcula solo y se descuenta del Revenue junto con los anuncios:

`Cash Collected = Revenue − inversión en ads − software del mes`

Los cambios de precio cierran la fila vieja y abren una nueva, así los meses pasados no cambian. Si no hay ningún costo cargado, se usa `ajustes_mensuales.costo_software` como respaldo.

## Conversaciones

"Conversaciones" son charlas con ida y vuelta: inbound (orgánicas + pagadas) más outbound que tuvo respuesta. Es el primer nivel del embudo y la base de "% Agenda / Conversación".

## Stack

Next.js 14 (App Router) · Tailwind v4 · Recharts · Supabase (Postgres) · Vercel (hosting + cron). Todo en plan gratuito.

## Correr local

```bash
npm install
cp .env.example .env.local   # sin Supabase corre con datos de ejemplo
npm run dev
```

Sin Supabase, en local entra directo con los datos de ejemplo de la sección 10 de la spec (aviso amarillo arriba). Publicado sin Supabase, no abre nada.

## Pantallas

| Ruta | Pestaña del spreadsheet |
|---|---|
| `/` | Dashboard (6 tarjetas, funnel, 2 gráficos, avisos) |
| `/metricas` | Métricas Ventas |
| `/setter` | Setter 1 |
| `/closers` | Marcos / Andrea / Gonzalo / Todos (celdas editables) |
| `/cobranzas` | Cobranzas |
| `/organico` | Orgánico + Top performers |
| `/anuncios` | Anuncios + Daily FM Tracker |
| `/puntos-de-contacto` | Puntos de contacto |
| `/costos` | Nuevo: software y costos fijos por mes |
| `/cargar` | Formulario manual (Venta / Cobranza / Asistencia, con PIN) |

Filtro global por mes, closer y fuente en la URL (`?mes=2026-10&closer=Marcos&fuente=Instagram`). Toggle oscuro/claro en la barra superior.

## Puesta en marcha

Ver **`docs/PUESTA_EN_MARCHA.md`**: 4 pasos (importar en Vercel, crear Supabase desde Vercel, cargar emails y secretos, activar Google). Las tablas, la seguridad y los usuarios se aplican solos en cada deploy (`scripts/db-setup.mjs`).

## Acceso y seguridad

Login solo con Google. Entra quien esté en la tabla `usuarios` (se carga desde `ADMIN_EMAILS`, `EDITOR_EMAILS`, `LECTOR_EMAILS`). Admin y editor cargan datos; lector solo mira. Detalle de todas las capas en `docs/PUESTA_EN_MARCHA.md`.

## Próximo: funnels por fuente

Separar los embudos por fuente de adquisición: **Lead magnet funnel**, **Follow Me Ads**, **Orgánico** y **Webinar**. Hoy el filtro de fuente usa Instagram / Webinar / WhatsApp / YouTube; hay que llevar esa clasificación al lead (`fuente` / funnel de origen) y mostrar un embudo por cada una.

## Origen de cada número

● automático (GHL / Meta / Instagram) · ◐ agente · ○ manual o migración. Lo manual nunca lo pisa el cron.

## Variables de entorno

Ver `.env.example`. Las claves se cargan solo en Vercel; nunca se commitean ni llegan al navegador.
