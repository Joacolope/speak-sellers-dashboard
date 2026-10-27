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

Sin `DASHBOARD_PASSWORD` no pide contraseña (solo en local). Sin `SUPABASE_URL` muestra los datos de ejemplo de la sección 10 de la spec, con un aviso arriba.

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

## Puesta en marcha (orden)

1. **Supabase:** crear proyecto, pegar `supabase/schema.sql` en el SQL Editor y correrlo.
2. **Vercel:** importar este repo. En *Settings → Environment Variables* cargar las variables de `.env.example`.
3. **Migración única:** exportar las pestañas del Sheet a `migracion/*.csv` y correr `npm run migrar -- --dry`, revisar totales (agendas octubre = 58, revenue ≈ 10.690) y después `npm run migrar`.
4. **Cron:** ya está en `vercel.json` (09:00 UTC = 06:00 AR). Probar a mano:
   `curl -H "Authorization: Bearer $CRON_SECRET" "https://speak-sellers-dashboard.vercel.app/api/cron/diario?dry=1"`
5. **Carga manual:** `claude/plataforma-carga-manual.md`.
6. **Agente diario:** tarea programada de Claude con el prompt de la sección 5.3 de la spec.

## Origen de cada número

● automático (GHL / Meta / Instagram) · ◐ agente · ○ manual o migración. Lo manual nunca lo pisa el cron.

## Variables de entorno

Ver `.env.example`. Las claves se cargan solo en Vercel; nunca se commitean.
