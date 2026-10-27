# Speak Sellers Dashboard · Spec de la plataforma

Spec completa para construir **Speak Sellers Dashboard**: una plataforma web en la nube, gratis, que reemplaza el spreadsheet "Dashboard - Speak Sellers" y se actualiza sola todos los días. Este documento sirve como prompt de ejecución para Claude Code y como referencia para el equipo.

**Dos archivos de referencia, usar los dos:**
1. **Lógica y estructura:** el spreadsheet actual (`docs.google.com/spreadsheets/d/15FKgRAHygjpS4UFrghPbBqsV5DmO1FBY3apfkgHe9Bc`). Se usa **solo como ejemplo**: de ahí salen las pestañas, columnas, fórmulas y el dibujo del funnel. **No se edita** durante la construcción. Los datos ya cargados ahí se migran una sola vez al final.
2. **Diseño visual:** `DESIGN.md` (sistema "Dovetail — blueprint control room at midnight"). Todo el frontend se construye con sus tokens, tipografías, superficies y reglas. La sección 7 de este documento resume cómo se aplica; ante cualquier duda manda `DESIGN.md`.

---

## 0. Resumen en una pantalla

| Capa | Qué hace | Costo | Frecuencia |
|---|---|---|---|
| **Automático** | Script que trae datos de Meta Ads, Instagram orgánico y GoHighLevel (GHL) y los guarda en la base | $0 (Vercel Cron) | Diario, 06:00 AR |
| **Manual (vía Claude)** | Joaco le dice a Claude "Elías pagó 1200 PIF" y Claude escribe en la base | $0 | Cuando pasa |
| **Agente diario de Claude** | Tarea programada que lee GHL (chats de WhatsApp, etiquetas, estados), detecta confirmaciones, no-shows y pagos, propone actualizaciones y deja un resumen | $0 (tarea programada de Claude) | Diario, 08:00 AR |
| **Dashboard** | Web simple, escaneable, con filtro por mes, para el cliente (Marcos) | $0 (Vercel) | Siempre actualizado |

Las tres capas escriben en la misma base (Supabase). El dashboard solo lee. Todo se **retroalimenta**: lo que carga el agente o Joaco manualmente queda disponible para el script del día siguiente (por ejemplo, para no duplicar agendas o para marcar una venta como cobrada).

---

## 1. Principios de diseño

1. **Hiper simple.** Una sola página principal. Nada que requiera manual de uso. Se llama **Speak Sellers Dashboard** y tiene toggle de modo oscuro / claro en la barra superior.
2. **Escaneable en 10 segundos.** Números grandes arriba, funnel en el medio, tablas abajo. Colores solo para semáforos (verde/rojo) y para el funnel.
3. **Misma división que el spreadsheet.** El cliente ya conoce esa estructura: Dashboard, Métricas de Venta, Setter, Closers, Cobranzas, Orgánico, Anuncios, Puntos de contacto.
4. **Filtro global por mes** (y opcionalmente por closer y por fuente). Todo lo que se ve responde al filtro.
5. **Nunca inventar datos.** Si una métrica no tiene fuente, se muestra "—" y una nota de dónde falta cargarla.
6. **Fuente de verdad única:** la base de datos. El spreadsheet deja de usarse una vez migrado.
7. **Montos en USD tal cual se cobran.** Sin conversiones automáticas. Si un pago es en ARS, se carga el equivalente en USD que diga Joaco.
8. **Acceso: link + contraseña simple.** La web vive en `speak-sellers-dashboard.vercel.app` (gratis, sin dominio propio). Cualquiera con el link y la contraseña entra, sin cuenta de Claude ni de Vercel. La contraseña es una sola, se guarda en la variable de entorno `DASHBOARD_PASSWORD` y la valida un `middleware.ts` de Next.js con una pantalla de ingreso simple (estilo `DESIGN.md`) y cookie de 30 días. No usar la protección de Vercel (es del plan pago). Agregar `noindex` para que no aparezca en Google. El login real por usuario (Joaco edita, Marcos solo ve) se agrega después con Supabase Auth sin rehacer nada.

---

## 2. Stack (todo en plan gratuito)

| Pieza | Herramienta | Por qué |
|---|---|---|
| Base de datos | **Supabase** (Postgres, plan Free) | Gratis, SQL, API REST automática, auth lista para cuando se quiera login. Límite: se pausa tras 7 días sin actividad → el cron diario evita la pausa. |
| Hosting + cron | **Vercel** (plan Hobby) | Ya está conectado a esta cuenta. Cron jobs gratis (1 por día es suficiente). Serverless functions para los scripts. |
| Frontend | **Next.js 14** (App Router) + **Tailwind v4** + **Recharts** | Simple, rápido, se despliega en Vercel sin configuración. Tailwind v4 porque `DESIGN.md` trae el bloque `@theme` listo para pegar. Fuentes Inter y JetBrains Mono desde Google Fonts. |
| Scripts de ingesta | **TypeScript** en `/app/api/cron/*` | Corren dentro de Vercel. Un endpoint por fuente. |
| Carga manual | **Claude** (esta conversación / tarea programada) vía Supabase REST o MCP de Supabase | Joaco dicta, Claude escribe. También un formulario mínimo en la web como respaldo. |
| Agente diario | **Tarea programada de Claude** con el MCP de GHL (ya conectado) y escritura a Supabase | Lee chats y etiquetas, cosas que la API sola no interpreta. |

**Costo total: $0/mes** para este volumen (1 cliente, cientos de leads/mes, decenas de ventas/mes).

---

## 3. Fuentes de datos y qué trae cada una

### 3.1 GoHighLevel (automático + agente)

- **Location:** `LANZA SELLING LLC` (`qcLzgJ0LSGXkHKb4pkHn`).
- **Calendario principal:** "Speak Sellers | Sesión de Diagnostico" (`tAl7IAvVZiFBju2gkkMG`). Round robin entre Marcos (`i8DcrP6UD17xI5U5mHCx`) y Andrea (`FfGvrQ15X7p3f52WBFSu`). Gonzalo tiene calendario propio (`f6KLn8x47VVmqcTAdICC`).
- **Pipeline:** "Speak Sellers | Pipeline Comercial" (`8tPjeFZ5cZYG40hQRQCM`). Etapas: Agendado → Reunión Confirmada → Seguimiento → Reserva $ → Cliente → Revisar.
- **Etiquetas relevantes en contactos/conversaciones:** `calificado`, `no calificado`, `pendiente de calificacion`, `no-show`, `pif`.
- **Formulario de agenda (custom fields):** ¿Sos closer en actividad?, rango de comisiones, nicho, dato previo.

**Endpoints que usa el script diario:**
- `GET /calendars/events` por calendario, rango últimos 45 días + próximos 30 → crea/actualiza `agendas`. Campos: `id`, `contactId`, `title`, `startTime`, `appointmentStatus` (confirmed / cancelled / noshow / showed), `assignedUserId`, `rescheduledAt`, `dateAdded`, `appointmentMeta.defaultFormDetails` (nombre, email, teléfono).
- `GET /opportunities/search` por pipeline → etapa actual de cada lead, `monetaryValue`, `status` (open/won/lost).
- `GET /contacts/{id}` → tags, custom fields (respuestas del formulario), país por prefijo telefónico.
- `GET /conversations/search` → `lastMessageDirection`, `lastMessageBody`, `tags`, `unreadCount`. Es lo que lee el **agente**, no el script.

**Nota:** GHL solo tiene datos desde el 12/10/2026 (fecha de creación del calendario y pipeline). Lo anterior (webinars del 6/9 y 4/10) queda como carga histórica desde el spreadsheet.

### 3.2 Meta Ads (automático)

- **Cuenta publicitaria:** `act_1431751731204204`. **Business:** `1943109262395693`.
- **Campañas a trackear:** solo **"Follow Me Ads"** (activa) y las dos campañas de **webinar** pasadas (6/9 y 4/10). Excluir Lookalike, Tráfico al perfil y cualquier otra.
- **Insights diarios** (`/act_{id}/insights`, `time_increment=1`, `level=campaign`, filtro por nombre de campaña): `spend`, `impressions`, `reach`, `frequency`, `cpm`, `ctr`, `actions` (profile visits = `onsite_conversion.ig_profile_visit` o `link_click` según el objetivo), follows (`onsite_conversion.follow` / `ig_follow`).
- **Token:** token de **usuario del sistema** del Business Manager con permisos `ads_read`, `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`. Si se usa un token de usuario normal, vence a los 60 días y el cron falla.

### 3.3 Instagram orgánico (automático)

- **Cuenta IG:** `marcoslanci` (asset `1696198744016068`).
- **Solo Instagram, solo orgánico.** Nada de Facebook, nada promocionado.
- **Media** (`/{ig-user-id}/media` con `media_product_type`, `timestamp`, `caption`, `comments_count`, `like_count`, `insights`):
  - **Reels:** `plays`/`views`, `reach`, `comments`, `saved`, `shares`. Si está promocionado (hay un ad con ese `effective_object_story_id`), se excluye.
  - **Historias** (`/{ig-user-id}/stories`, disponibles solo 24 h → **por eso el cron debe correr todos los días**): `impressions`/`views`, `replies`, `exits`, `taps_forward`, `taps_back`.
- **Mensajería** (`/{ig-user-id}/insights?metric=...` o Business Suite): conversaciones iniciadas por día, orgánicas vs. pagadas. Alimenta "Nuevas conversaciones" del Setter.
- **Palabra clave del reel:** se extrae del caption (`Comentá X`, o la primera palabra en mayúsculas). Se guarda en `tipo_cta`.

### 3.4 Manual (vía Claude o formulario)

Lo que ninguna API sabe:
- Si el lead **asistió** cuando GHL no lo marcó.
- **Compró / Reserva / No**, **producto**, **cash collected**, **revenue**, método (PIF, cuotas).
- **Cobranzas:** fecha de cobro, monto, pendiente, cuotas restantes.
- **Reembolsos.**
- **Cualificación económica (1–10)** que define el closer.
- **Fuente** cuando hay duda (regla: ante la duda, la más general → "Instagram").
- **Puntos de contacto:** primer y último punto de contacto del comprador (viene del formulario de onboarding).
- **Weekly del setter** (en frío, respuestas, seguimientos, links) si no se automatiza desde IG.
- **Costo de software** del mes.

---

## 4. Modelo de datos (Supabase)

Nombres en español, en minúscula, snake_case. Todas las tablas tienen `id uuid`, `created_at`, `updated_at`, `source` (`ghl` | `meta` | `ig` | `manual` | `agente` | `migracion`) y `notas text`.

### `leads`
| Campo | Tipo | Origen |
|---|---|---|
| ghl_contact_id | text unique | GHL |
| nombre, email, telefono, pais | text | GHL / manual |
| fuente | enum: Instagram, WhatsApp, Webinar, YouTube, Referido, Otro | manual / GHL |
| tags | text[] | GHL |
| closer_en_actividad, rango_comisiones, nicho, dato_previo | text | GHL (formulario) |
| cualificacion_economica | int 1–10 | manual |
| primer_punto_contacto, ultimo_punto_contacto | text | manual (onboarding) |
| etapa_pipeline | text | GHL |

### `agendas`
| Campo | Tipo | Origen |
|---|---|---|
| ghl_event_id | text unique | GHL |
| lead_id | fk leads | |
| closer | enum: Marcos, Andrea, Gonzalo | GHL (assignedUserId) |
| fecha_llamada | timestamptz | GHL |
| fecha_agendada | timestamptz | GHL (dateAdded) |
| estado_ghl | text (confirmed/cancelled/noshow/showed) | GHL |
| confirmada_whatsapp | bool | agente |
| asistio | enum: Asistió, No show, Canceló, Pendiente | GHL → agente → manual |
| oferta_hecha | bool | manual / agente |
| compro | enum: Si, No, Reserva | manual |
| producto | text | manual |
| cash_collected, revenue | numeric USD | manual |
| metodo_pago | enum: PIF, Cuotas, Reserva | manual |
| reprogramada_desde | timestamptz | GHL (rescheduledAt) |

### `cobranzas`
| Campo | Tipo |
|---|---|
| agenda_id | fk agendas |
| fecha_cobro | date |
| monto_cobrado | numeric USD |
| pendiente | numeric USD |
| cuotas_restantes | int |
| closer | enum |
| es_reembolso | bool (monto negativo) |

### `setter_diario`
| Campo | Tipo | Origen |
|---|---|---|
| fecha | date unique | |
| conv_organicas, conv_pagadas | int | IG mensajería |
| bienvenidas, conv_frio, mensajes_seguimiento, respuestas | int | manual (weekly) |
| seguimientos, links_enviados, agendas | int | manual / GHL |

### `ads_diario`
| Campo | Tipo | Origen |
|---|---|---|
| fecha | date | Meta |
| campana | enum: follow_me, webinar | Meta |
| inversion, impresiones, alcance, frecuencia, cpm, ctr | numeric | Meta |
| visitas_perfil, seguidores, conversaciones | int | Meta |
| bitacora | text | manual |

### `organico_diario`
| Campo | Tipo | Origen |
|---|---|---|
| fecha | date unique | |
| tipo_historia | enum: CTA a LM, CTA de Venta, Nutrición, Q&A, Personal | manual / agente (clasifica por texto) |
| views_primera, views_ultima, cantidad_historias, respuestas, respuestas_encuesta | int | IG |
| formato_reel | enum: Reel, Carrusel, Imagen | IG |
| tipo_cta | text (palabra clave) | IG (caption) |
| comentarios_48h | int | IG |
| notas | text | |

### `organico_piezas` (detalle por reel/historia, para top performers)
| Campo | Tipo |
|---|---|
| ig_media_id | text unique |
| fecha, tipo (reel/historia), titulo, views, alcance, comentarios, respuestas, guardados, compartidos, promocionado bool |

### `ajustes_mensuales`
| Campo | Tipo |
|---|---|
| mes | date (primer día) |
| costo_software | numeric |
| notas | text |

### `log_agente`
| Campo | Tipo |
|---|---|
| fecha, resumen text, cambios jsonb (qué propuso/aplicó), pendientes jsonb |

### Vistas SQL (calculadas, nada se tipea)
- `v_metricas_mes`: todas las columnas de la pestaña "Métricas Ventas" (ver sección 6.2).
- `v_funnel_mes`: DMs → Agendas → Asistencias → Ofertas → Cierres → Ventas USD.
- `v_closer_mes`: por closer: agendas, asistencias, % show, ofertas, cierres, % cierre, cash, revenue.
- `v_top_organico_mes`: top 5 historias por respuestas, top 5 reels por comentarios y por views.
- `v_cobranzas_pendientes`: quién debe cuánto y cuándo vence.

---

## 5. Las tres capas de actualización

### 5.1 Automático: cron diario en Vercel (06:00 AR)

`vercel.json` → `{"crons":[{"path":"/api/cron/diario","schedule":"0 9 * * *"}]}` (09:00 UTC = 06:00 AR).

`/api/cron/diario` llama en orden:
1. `syncGhl()` → agendas (últimos 45 días + próximos 30), estados, etapas, tags, formulario. **Upsert por `ghl_event_id`.** Nunca pisa `asistio`, `compro`, `cash_collected` si ya fueron cargados manualmente (`source = manual`); solo actualiza campos que vienen de GHL.
2. `syncMetaAds()` → `ads_diario` de ayer y anteayer (Meta corrige datos 48 h).
3. `syncIgOrganico()` → historias de las últimas 24 h, reels de los últimos 7 días (para capturar comentarios a 48 h), mensajería de ayer.
4. `recalcular()` → refresca vistas materializadas si se usan.
5. Escribe en `log_agente` una línea tipo `cron ok: 12 agendas, 2 días ads, 5 historias, 1 reel`.

Si una fuente falla, las otras siguen. El error queda en el log y se muestra como un aviso discreto en el dashboard ("Meta no actualizó hoy").

### 5.2 Manual: Joaco dicta, Claude escribe

Patrón de uso en esta conversación (o en cualquier chat del proyecto):

> "Elías Sánchez pagó 1200 PIF" → Claude busca la agenda de Elías, pone `asistio = Asistió`, `oferta_hecha = true`, `compro = Si`, `metodo_pago = PIF`, `cash_collected = 1200`, `revenue = 1200`, `source = manual`, y confirma en una línea.

> "Betina pagó 670 hoy, le quedan 1000 para mediados de noviembre" → inserta en `cobranzas` y actualiza `cash_collected` acumulado.

> "Les devolvimos a Martinetti y Murakami" → inserta cobranzas negativas (`es_reembolso = true`) y pone `compro = No`.

> "Axel fue no show" → `asistio = No show`.

Reglas para Claude:
- Buscar el lead por nombre; si hay más de un match, preguntar.
- Escribir solo en celdas vacías o confirmar antes de pisar.
- Responder con el cambio hecho y el efecto en el total del mes (una línea).
- Si el dato no tiene dónde ir, decirlo y no inventar columna.

Respaldo: formulario web mínimo en `/cargar` con tres bloques (Venta, Cobranza, Asistencia). Sin login, con un PIN de 4 dígitos en variable de entorno.

### 5.3 Agente diario de Claude (08:00 AR)

Tarea programada de Claude con acceso al MCP de GHL y a Supabase. Prompt base:

> Leé en GHL las conversaciones y agendas de los últimos 3 días y las próximas 48 h. Para cada lead agendado:
> 1. Si el último mensaje del lead confirma la reunión (texto, "sí", "dale", o mandó audio después del mensaje de confirmación), marcá `confirmada_whatsapp = true`.
> 2. Si la etiqueta dice `no-show` o el estado de GHL es `noshow`, poné `asistio = No show`.
> 3. Si la etapa del pipeline es `Cliente` o tiene tag `pif` y en la base no hay venta cargada, **no inventes el monto**: dejalo en la lista de pendientes para Joaco.
> 4. Si la cita fue reprogramada, actualizá `fecha_llamada` y anotá la fecha anterior en `reprogramada_desde`.
> 5. Si hubo charla previa por WhatsApp (mensajes antes de agendar), anotalo en `notas` del lead.
> 6. Clasificá `tipo_historia` del día anterior según el texto de las historias (CTA a LM / CTA de Venta / Nutrición / Q&A / Personal).
> Escribí en `log_agente` un resumen de 5 líneas máximo: qué cambió, qué quedó pendiente de confirmar por Joaco (asistencias sin marcar, ventas sin monto, pagos en ARS sin USD). Marcá cada cambio con `source = agente`.

El agente **propone y aplica lo seguro** (confirmaciones, no-shows, reprogramaciones) y **deja pendiente lo que implica plata** (montos, cuotas, reembolsos). Joaco resuelve los pendientes dictándole a Claude (capa 5.2).

### 5.4 Retroalimentación entre capas

- Lo que carga Joaco (`manual`) nunca lo pisa el cron ni el agente.
- Lo que carga el agente (`agente`) lo puede corregir Joaco; el cron no lo toca.
- El cron solo escribe campos de origen API (`ghl`, `meta`, `ig`).
- El dashboard muestra un indicador por fila: ● automático / ◐ agente / ○ manual, para que el cliente sepa de dónde salió cada número.

---

## 6. Dashboard: pantallas

Una sola app, navegación lateral con las mismas secciones que el spreadsheet. **Filtro global arriba:** Mes (default: mes actual), Closer (todos / Marcos / Andrea / Gonzalo), Fuente (todas / Instagram / Webinar / WhatsApp / YouTube).

### 6.1 Inicio (equivale a la pestaña "Dashboard")

Orden vertical, todo en una pantalla de desktop sin scroll excesivo:

**Fila 1 · 6 tarjetas grandes** (número + variación vs. mes anterior en chico):
Revenue · Cash Collected (después de ads) · Ventas · Agendas · % Asistencia · % Cierre sobre ofertas

**Fila 2 · Funnel (el "dibujo del embudo")**
Barras horizontales decrecientes, de arriba hacia abajo:
1. **Conversaciones** (DMs nuevas, orgánicas + pagadas)
2. **Agendas** (todas las llamadas, de todos los closers)
3. **Asistencias**
4. **Ofertas hechas**
5. **Cierres** (Si + Reserva)
6. **Ventas USD** (revenue)

Entre cada nivel, el % de conversión en gris. Al pasar el mouse, el número exacto y el desglose por closer.

**Fila 3 · Dos gráficos**
- Izquierda: **Inversión en ads vs. Cash Collected** por semana (barras + línea).
- Derecha: **Agendas por día** del mes (barras), con línea de asistencias.

**Fila 4 · Avisos** (solo si hay)
- Cobranzas pendientes esta semana.
- Pendientes del agente (asistencias sin marcar, ventas sin monto).
- Última actualización: fecha/hora de cada fuente.

### 6.2 Métricas de Venta (equivale a "Métricas Ventas")

Tabla por mes (filas = meses, como el spreadsheet), agrupada con tres encabezados de color igual que ahí:

**Setter:** Nuevas conv. orgánicas · Nuevas conv. pagadas · Seguimientos · Links enviados · Agendas
**Closer:** Asistencias · % Asistencia · No show · % No show · Reservas · Ventas · Ofertas hechas · % cierre total · % cierre / asistencia · % cierre / oferta · Cash Collected · Revenue · New Cash · Old Cash
**Conversión:** % Agenda / DM · % Agenda / Link

Fórmulas (idénticas al spreadsheet, aplicadas sobre la base):
- Agendas = suma de agendas de **todos** los closers del mes.
- % Asistencia = Asistencias / Agendas.
- Ventas = agendas con `compro in (Si, Reserva)`.
- % cierre total = Ventas / Agendas; / asistencia = Ventas / Asistencias; / oferta = Ventas / Ofertas.
- **Revenue** = suma de `revenue` (plata que entró, no valor del programa) − reembolsos.
- **Cash Collected** = Revenue − inversión en ads del mes − costo de software del mes.
- New Cash = cash de ventas cerradas en el mes; Old Cash = cobranzas de ventas de meses anteriores.
- % Agenda / DM = Agendas / Conversaciones.

Semáforo por celda contra objetivos configurables (`ajustes_mensuales`): % Asistencia ≥ 60 % verde; % cierre / oferta ≥ 30 % verde; etc.

### 6.3 Setter

Tabla diaria del mes con las columnas de la pestaña "Setter 1" (Inbound / Outbound / Global) y un gráfico de conversaciones orgánicas vs. pagadas por día. Botón "Comparar con Meta" que muestra la diferencia entre lo reportado en el weekly y lo que dice Meta (como el cruce que dio 877 vs 856).

### 6.4 Closers

Una pestaña por closer (Marcos, Andrea, Gonzalo) más "Todos". Tabla de agendas con exactamente las columnas del spreadsheet: Fecha · Nombre · Teléfono · País · Cualificación (1–10) · ¿Asistió? · Oferta hecha · Compró · Producto · Cash Collected · Revenue · Fuente, más dos columnas nuevas: **Confirmada por WhatsApp** (✓/✗ del agente) y **Estado GHL**.

Arriba de la tabla, 4 tarjetas por closer: Agendas · % Show · % Cierre · Cash.

Las celdas manuales son editables inline (click → dropdown o número) y escriben a Supabase con `source = manual`.

### 6.5 Cobranzas

Tabla: Nombre · Fecha de cobro · Monto cobrado · Pendiente · Closer · Cuotas restantes · Próximo vencimiento. Totales arriba: cobrado en el mes, pendiente total, reembolsos.

### 6.6 Orgánico

Igual que la pestaña "Orgánico": tabla diaria con Historias (tipo, views primera/última, cantidad, drop-off calculado, respuestas) y Reels (formato, palabra clave, comentarios 48 h). A la derecha, **Top Performers del mes**: top 3 historias por respuestas y top 3 reels por comentarios y por views, con miniatura y link al post. Marca "a confirmar" cuando el dato de Meta es anómalo (como el 331 del 8/10).

Solo cuenta contenido **orgánico de Instagram**. Si una pieza fue promocionada se muestra con un ícono de megáfono y no entra en los rankings.

### 6.7 Anuncios

Dos bloques, como la pestaña "Anuncios":
- **Follow Me Ads (mensual):** Inversión · Visitas al perfil · Nuevos seguidores · Costo por seguidor · Costo por visita.
- **Webinars / otras campañas:** Inversión · Conversaciones · Costo por DM · New Cash generado.

Y abajo el **Daily FM Tracker** con las columnas del spreadsheet (Inversión, Impresiones, Alcance, CPM, CTR, Frecuencia, Visitas, Seguidores, Conversión, Costo por seguidor, Bitácora editable).

### 6.8 Puntos de contacto

Tabla de compradores: Mes · Fecha de cierre · Nombre e Instagram · Cash Collected · Fuente · Primer punto de contacto · Último punto de contacto · Fuente (funnel / Instagram). Gráfico de torta por fuente.

---

## 7. Diseño visual (según `DESIGN.md`)

El dashboard sigue al pie de la letra el sistema de `DESIGN.md`: tipo sala de control, el fondo recede y los datos mandan. Copiar el bloque `@theme` de Tailwind v4 de `DESIGN.md` tal cual en `globals.css`.

**Nombre visible:** "Speak Sellers Dashboard" en la barra superior, Inter 600, con un eyebrow en JetBrains Mono arriba ("SPEAK SELLERS · MÉTRICAS").

### Modo oscuro y modo claro (toggle en toda la plataforma)

`DESIGN.md` define el tema oscuro. El claro es el **mismo sistema invertido en tono**: mismas fuentes, radios, espaciados, un solo acento `#6798ff`, sin sombras ni gradientes. Lo único que cambia son las superficies y el texto.

- **Toggle** en la barra superior (ícono sol/luna, 16px stroke, estilo ghost). Recuerda la elección en `localStorage` y respeta `prefers-color-scheme` la primera vez.
- Implementar con `data-theme="dark|light"` en `<html>` y variables CSS semánticas. Los componentes usan **solo** las semánticas (`--bg`, `--surface`, `--surface-2`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--accent`), nunca los hex directos. Así todo cambia a la vez.

| Variable | Oscuro (`DESIGN.md`) | Claro (invertido) |
|---|---|---|
| `--bg` (página) | `#0a0a0a` | `#ffffff` |
| `--surface` (tarjetas, tablas, botones) | `#1e1e1e` | `#f4f4f4` |
| `--surface-2` (secciones anidadas, filtros) | `#141414` | `#fafafa` |
| `--border` (hairline) | `#1e1e1e` | `#e6e6e6` |
| `--border-strong` (outline, frames) | `#313131` / `#454545` | `#d4d4d4` / `#bdbdbd` |
| `--text` | `#ffffff` | `#0a0a0a` |
| `--text-muted` | `#a7a7a7` | `#6b6b6b` |
| `--text-disabled` | `#7c7c7c` | `#9a9a9a` |
| `--accent` | `#6798ff` | `#6798ff` (mismo; sobre blanco cumple contraste para strokes y texto 14px+) |
| Grid wireframe | 1px `#1e1e1e` | 1px `#ececec` |
| Botón primario | fondo `#ffffff`, texto `#0a0a0a` | fondo `#0a0a0a`, texto `#ffffff` |
| Botón secundario | borde `#454545`, texto blanco | borde `#bdbdbd`, texto `#0a0a0a` |
| Series de gráficos | principal blanco, secundaria azul, grilla `#454545` | principal `#0a0a0a`, secundaria azul, grilla `#d4d4d4` |
| Semáforos | verde `#16A34A` / rojo `#DC2626` | verde `#15803D` / rojo `#B91C1C` (un paso más oscuro para contraste) |

Reglas que no cambian entre modos: radio 8px (4px en tags), sin `box-shadow`, sin gradientes de color, un solo acento, `#6798ff` nunca como fondo de botón, texto nunca bajo 14px salvo eyebrows/tags, Inter + JetBrains Mono.

El resto de esta sección describe el modo oscuro con los hex de `DESIGN.md`; en modo claro se leen con la tabla de arriba.

**Superficies (sin sombras, separación solo por tono):**
- Página `#0a0a0a` con el **grid wireframe** de 1px `#1e1e1e` (celdas de ~48px) como fondo, hecho con `repeating-linear-gradient`, nunca con bordes de elementos.
- Tarjetas y tablas `#1e1e1e`, radio 8px, padding 24px, borde hairline `#1e1e1e` o `#313131`.
- Secciones anidadas (filtros, avisos) `#141414`.

**Tipografía:**
- Inter para todo. 400 cuerpo, 500 botones y nav, 600 títulos.
- Números grandes de las tarjetas: Inter 600 a 40px, tracking −0.84px, blanco.
- Etiquetas de métrica: 14px `#a7a7a7`.
- Eyebrows de sección ("FUNNEL", "MÉTRICAS DE VENTA", "CLOSERS"): JetBrains Mono 400 12px mayúsculas, tracking 0.85px, `#a7a7a7`.
- Nada por debajo de 14px salvo eyebrows y tags (12px).

**Color: un solo acento, `#6798ff`.**
- Se usa en: estado activo del filtro y de la nav, íconos de las tarjetas (16px, stroke 1.5px), y la **barra superior del funnel** (Conversaciones). Las barras siguientes del funnel bajan en opacidad del mismo azul (100 % → 40 %), nunca otro color.
- Líneas y barras de los gráficos: blanco para la serie principal, `#6798ff` para la secundaria, `#454545` para grillas. Sin paletas multicolor.
- **Única excepción al monocromo:** semáforos de ¿Asistió? / Compró y variaciones vs. mes anterior. Verde `#16A34A` y rojo `#DC2626` solo como texto o punto de 8px, nunca como fondo de celda. Esto es funcional, no decorativo, y respeta el espíritu de `DESIGN.md`.
- `#6798ff` nunca como fondo de botón.

**Botones:** primario blanco `#ffffff` con texto `#0a0a0a`; secundario borde 1px `#454545` texto blanco. Radio 8px, padding 16/10, Inter 500 14px.

**Filtros (Mes / Closer / Fuente):** chips con radio 4px, fondo `#1e1e1e`, borde `#313131`; el activo con borde `#6798ff` y texto blanco.

**Tablas:** filas de 40px, texto 14px, encabezados en JetBrains Mono 12px `#a7a7a7`, separadores hairline `#1e1e1e`, hover `#141414`. Celdas editables muestran un borde `#454545` al pasar el mouse.

**Funnel:** barras horizontales centradas, ancho proporcional, altura 48px, radio 8px, etiqueta blanca adentro a la izquierda y número a la derecha; el % de conversión entre barras en JetBrains Mono 12px `#a7a7a7`.

**Formato de números:** miles con punto (1.200), USD con `$` adelante, porcentajes con un decimal.

**Layout:** max-width 1200px, nav superior de 64px (sin sidebar, como indica `DESIGN.md`), secciones separadas por 64px, elementos por 8–16px. Mobile: tarjetas apiladas, funnel se mantiene, tablas con scroll horizontal.

**Prohibido** (de `DESIGN.md`, en los dos modos): sombras, gradientes de color, segundo color de acento, radios pill, fondo `#000000` puro, texto bajo 400 de peso, hex hardcodeados en componentes (siempre variables semánticas).

---

## 8. Plan de construcción (orden)

1. **Supabase:** crear proyecto, correr `schema.sql` (tablas + vistas + enums). Habilitar RLS con política "solo service role escribe, anon lee" hasta que haya login.
2. **Repo + Next.js en Vercel:** crear el repo de GitHub `speak-sellers-dashboard` (es la fuente de verdad del código; el entorno de Claude Code, nube o local, da igual). Conectar Vercel a ese repo para que cada push publique solo. Crear el proyecto Next.js `speak-sellers-dashboard`, copiar `DESIGN.md` a la raíz del repo y su bloque `@theme` a `globals.css`, variables de entorno (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `GHL_TOKEN`, `GHL_LOCATION_ID`, `META_TOKEN`, `META_AD_ACCOUNT`, `IG_USER_ID`, `CRON_SECRET`, `PIN_CARGA`, `DASHBOARD_PASSWORD`).
3. **Migración única** desde el spreadsheet: script `migrar.ts` que lee el Sheet (export CSV por pestaña) y carga `agendas`, `cobranzas`, `setter_diario`, `ads_diario`, `organico_diario`, `leads` con `source = migracion`. Se corre una vez, se revisa contra los totales del Sheet (agendas octubre = 58, revenue octubre ≈ 10.690, etc.) y listo.
4. **Cron `/api/cron/diario`** con las tres sincronizaciones. Probar a mano con `?dry=1`.
5. **Dashboard:** Inicio → Métricas de Venta → Closers → el resto.
6. **Carga manual:** endpoint `/api/cargar` + instrucciones para Claude en el proyecto (`claude/plataforma-carga-manual.md`).
7. **Agente diario:** tarea programada de Claude con el prompt de 5.3.
8. **Validación final:** comparar un mes completo plataforma vs. spreadsheet; las diferencias deben explicarse (agendas nuevas de GHL, reembolsos, etc.).
9. Después, cuando se quiera: login con Supabase Auth (Marcos ve, Joaco edita).

---

## 9. Lo que Joaco tiene que hacer (Claude no puede)

| Qué | Dónde | Cuándo |
|---|---|---|
| Crear cuenta y proyecto en **Supabase** | supabase.com | Antes del paso 1 |
| Generar token de **usuario del sistema** en Meta Business Manager con `ads_read`, `instagram_basic`, `instagram_manage_insights` | business.facebook.com → Configuración → Usuarios del sistema | Antes del paso 4 |
| Generar **integración privada** en GHL (Settings → Private Integrations) con scopes de calendarios, contactos, oportunidades y conversaciones (lectura) | GHL | Antes del paso 4 |
| Aceptar el permiso de **GitHub** para crear el repo y conectar Vercel | Claude Code / Vercel | Paso 2 |
| Pegar los tokens y la **contraseña del dashboard** en **Vercel → Settings → Environment Variables** | Vercel | Antes del paso 4 |
| Pasarle a Marcos el **link + contraseña** | WhatsApp | Cuando esté publicado |
| Decidir la **cotización** para pagos en ARS (Martín, Damián, Cristian) o pasar el USD exacto | Chat | Cuando quiera |
| Confirmar los **pendientes** que deja el agente cada mañana | Chat | Diario, 1 minuto |

Claude indica exactamente dónde va cada clave, pero no las carga ni las ve.

---

## 10. Datos ya conocidos para la migración (octubre 2026)

- Agendas octubre: **58** (54 del tracker + 4 que estaban en GHL y no en el Sheet).
- Revenue octubre: **≈ 10.690 USD** después de reembolsos (incluye Elías 1.200 PIF).
- Reembolsos: Martinetti y Murakami.
- Inversión Follow Me Ads 21/9–25/10: **1.034,15 USD**, 18.324 visitas.
- Webinar 6/9: 286,92 USD · Webinar 4/10: 2.449,32 USD, 975 registros, 24 agendas activas.
- Conversaciones IG 20 días: Franco reportó 877, Meta 856 (2,5 % de diferencia).
- Top orgánico (26/8–24/10, solo IG orgánico): historias 8/10 con 331 respuestas (**a confirmar**); reel «CLASE» 19/9 con 173 comentarios; reel «MIRO» 30/9 con 10.139 views.
- Pendientes: pagos en ARS (Martín ~600, Damián ~600, Cristian ~67), cash de agosto y septiembre, costo de software, asistencias del 26/10 (Gino, Gianluca, Tiago, Daniela, Elbio) y Luis Paulino (14/10), reprogramaciones de Daniela y Tomás al 29/10.

---

## 11. Prompt corto para arrancar en Claude Code

> Construí **Speak Sellers Dashboard** siguiendo `speak-sellers-plataforma-spec.md` para la lógica y `DESIGN.md` para todo lo visual (Inter + JetBrains Mono, un solo acento `#6798ff`, sin sombras ni gradientes, grid wireframe de fondo). Tiene que tener **modo oscuro y modo claro** en toda la plataforma, con toggle en la barra superior: el oscuro es el de `DESIGN.md` y el claro es el mismo sistema invertido según la tabla de la sección 7 de la spec; usá variables CSS semánticas y `data-theme`, nunca hex directos en componentes. Usá el spreadsheet "Dashboard - Speak Sellers" solo como referencia de pestañas, columnas y fórmulas; no lo edites. Empezá por el paso 1 (schema de Supabase) y el paso 5 (pantalla Inicio con las 6 tarjetas, el funnel y los dos gráficos) con los datos de ejemplo de la sección 10, para ver el diseño antes de conectar las APIs. Next.js 14, Tailwind v4, Recharts. Todo en español. Guardá el código en un repo de GitHub `speak-sellers-dashboard` y conectalo a Vercel para que cada push publique solo. Sin login por usuario: protegé todo con una contraseña única (`DASHBOARD_PASSWORD` + `middleware.ts`, cookie de 30 días, `noindex`). Cuando esté desplegado en Vercel, pasame la URL y seguí con el cron (paso 4), la carga manual (paso 6) y el agente diario (paso 7).
