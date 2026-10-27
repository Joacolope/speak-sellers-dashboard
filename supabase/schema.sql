-- Speak Sellers Dashboard · schema de Supabase
-- Correr una sola vez en el SQL Editor del proyecto. Idempotente (if not exists / or replace).

create extension if not exists "pgcrypto";

-- ───────────────────────── Enums ─────────────────────────
do $$ begin
  create type source_t as enum ('ghl','meta','ig','manual','agente','migracion');
exception when duplicate_object then null; end $$;
do $$ begin
  create type fuente_t as enum ('Instagram','WhatsApp','Webinar','YouTube','Referido','Otro');
exception when duplicate_object then null; end $$;
do $$ begin
  create type closer_t as enum ('Marcos','Andrea','Gonzalo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type asistio_t as enum ('Asistió','No show','Canceló','Pendiente');
exception when duplicate_object then null; end $$;
do $$ begin
  create type compro_t as enum ('Si','No','Reserva');
exception when duplicate_object then null; end $$;
do $$ begin
  create type metodo_pago_t as enum ('PIF','Cuotas','Reserva');
exception when duplicate_object then null; end $$;
do $$ begin
  create type campana_t as enum ('follow_me','webinar');
exception when duplicate_object then null; end $$;
do $$ begin
  create type tipo_historia_t as enum ('CTA a LM','CTA de Venta','Nutrición','Q&A','Personal');
exception when duplicate_object then null; end $$;
do $$ begin
  create type formato_reel_t as enum ('Reel','Carrusel','Imagen');
exception when duplicate_object then null; end $$;

-- ───────────────────────── Tablas ─────────────────────────
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'ghl',
  notas text,
  ghl_contact_id text unique,
  nombre text not null,
  email text,
  telefono text,
  pais text,
  instagram text,
  fuente fuente_t,
  tags text[] default '{}',
  closer_en_actividad text,
  rango_comisiones text,
  nicho text,
  dato_previo text,
  cualificacion_economica int check (cualificacion_economica between 1 and 10),
  primer_punto_contacto text,
  ultimo_punto_contacto text,
  etapa_pipeline text
);

create table if not exists agendas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'ghl',
  notas text,
  ghl_event_id text unique,
  lead_id uuid not null references leads(id) on delete cascade,
  closer closer_t not null,
  fecha_llamada timestamptz not null,
  fecha_agendada timestamptz,
  estado_ghl text,
  confirmada_whatsapp boolean,
  asistio asistio_t not null default 'Pendiente',
  oferta_hecha boolean,
  compro compro_t,
  producto text,
  cash_collected numeric(12,2),
  revenue numeric(12,2),
  metodo_pago metodo_pago_t,
  reprogramada_desde timestamptz
);
create index if not exists agendas_fecha_idx on agendas (fecha_llamada);
create index if not exists agendas_lead_idx on agendas (lead_id);

create table if not exists cobranzas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  notas text,
  agenda_id uuid not null references agendas(id) on delete cascade,
  fecha_cobro date not null,
  monto_cobrado numeric(12,2) not null,
  pendiente numeric(12,2),
  cuotas_restantes int,
  proximo_vencimiento date,
  closer closer_t not null,
  es_reembolso boolean not null default false
);
create index if not exists cobranzas_fecha_idx on cobranzas (fecha_cobro);

create table if not exists setter_diario (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  notas text,
  fecha date not null unique,
  conv_organicas int,
  conv_pagadas int,
  bienvenidas int,
  conv_frio int,
  mensajes_seguimiento int,
  respuestas int,           -- outbound con respuesta: cuenta como conversación
  seguimientos int,
  links_enviados int,
  agendas int
);

create table if not exists ads_diario (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'meta',
  notas text,
  fecha date not null,
  campana campana_t not null,
  inversion numeric(12,2) not null default 0,
  impresiones int,
  alcance int,
  frecuencia numeric(8,2),
  cpm numeric(10,2),
  ctr numeric(8,4),
  visitas_perfil int,
  seguidores int,
  conversaciones int,
  bitacora text,
  unique (fecha, campana)
);

create table if not exists organico_diario (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'ig',
  notas text,
  fecha date not null unique,
  tipo_historia tipo_historia_t,
  views_primera int,
  views_ultima int,
  cantidad_historias int,
  respuestas int,
  respuestas_encuesta int,
  formato_reel formato_reel_t,
  tipo_cta text,
  comentarios_48h int
);

create table if not exists organico_piezas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'ig',
  notas text,
  ig_media_id text not null unique,
  fecha date not null,
  tipo text not null check (tipo in ('reel','historia')),
  titulo text not null,
  views int,
  alcance int,
  comentarios int,
  respuestas int,
  guardados int,
  compartidos int,
  promocionado boolean not null default false,
  url text,
  a_confirmar boolean not null default false
);

create table if not exists ajustes_mensuales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  notas text,
  mes date not null unique,
  costo_software numeric(12,2),
  objetivo_asistencia numeric(5,4) default 0.60,
  objetivo_cierre_oferta numeric(5,4) default 0.30
);

create table if not exists log_agente (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'agente',
  notas text,
  fecha timestamptz not null default now(),
  resumen text not null,
  cambios jsonb,
  pendientes jsonb
);

-- ───────────────────────── updated_at automático ─────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['leads','agendas','cobranzas','setter_diario','ads_diario','organico_diario','organico_piezas','ajustes_mensuales','log_agente'] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ───────────────────────── Vistas ─────────────────────────
-- Todo se calcula, nada se tipea.

create or replace view v_funnel_mes as
with ag as (
  select date_trunc('month', fecha_llamada at time zone 'America/Argentina/Buenos_Aires')::date as mes,
         count(*) as agendas,
         count(*) filter (where asistio = 'Asistió') as asistencias,
         count(*) filter (where oferta_hecha) as ofertas,
         count(*) filter (where compro in ('Si','Reserva')) as cierres,
         coalesce(sum(revenue) filter (where compro in ('Si','Reserva')), 0) as revenue_bruto
  from agendas group by 1
), conv as (
  -- Conversaciones con ida y vuelta: inbound (orgánicas + pagadas) + outbound con respuesta
  select date_trunc('month', fecha)::date as mes,
         sum(coalesce(conv_organicas,0) + coalesce(conv_pagadas,0) + coalesce(respuestas,0)) as conversaciones
  from setter_diario group by 1
), rf as (
  -- Solo reembolsos de ventas que siguen contando como venta (parciales); una venta
  -- devuelta por completo ya salió del conteo con compro = 'No'.
  select date_trunc('month', c.fecha_cobro)::date as mes, coalesce(sum(abs(c.monto_cobrado)),0) as reembolsos
  from cobranzas c join agendas a on a.id = c.agenda_id
  where c.es_reembolso and a.compro in ('Si','Reserva') group by 1
)
select ag.mes, conv.conversaciones, ag.agendas, ag.asistencias, ag.ofertas, ag.cierres,
       ag.revenue_bruto - coalesce(rf.reembolsos,0) as ventas_usd
from ag left join conv using (mes) left join rf using (mes);

create or replace view v_metricas_mes as
with f as (select * from v_funnel_mes),
ag as (
  select date_trunc('month', fecha_llamada at time zone 'America/Argentina/Buenos_Aires')::date as mes,
         count(*) filter (where asistio = 'No show') as no_show,
         count(*) filter (where compro = 'Reserva') as reservas
  from agendas group by 1
),
st as (
  select date_trunc('month', fecha)::date as mes,
         sum(conv_organicas) as conv_organicas, sum(conv_pagadas) as conv_pagadas,
         sum(respuestas) as conv_outbound,
         sum(seguimientos) as seguimientos, sum(links_enviados) as links_enviados
  from setter_diario group by 1
),
ads as (select date_trunc('month', fecha)::date as mes, sum(inversion) as inversion_ads from ads_diario group by 1),
aj as (select mes, costo_software from ajustes_mensuales),
cash as (
  select date_trunc('month', c.fecha_cobro)::date as mes,
         sum(c.monto_cobrado) filter (where not c.es_reembolso and date_trunc('month', a.fecha_llamada at time zone 'America/Argentina/Buenos_Aires')::date = date_trunc('month', c.fecha_cobro)::date) as new_cash,
         sum(c.monto_cobrado) filter (where not c.es_reembolso and date_trunc('month', a.fecha_llamada at time zone 'America/Argentina/Buenos_Aires')::date <> date_trunc('month', c.fecha_cobro)::date) as old_cash
  from cobranzas c join agendas a on a.id = c.agenda_id group by 1
)
select f.mes,
       st.conv_organicas, st.conv_pagadas, st.conv_outbound, f.conversaciones, st.seguimientos, st.links_enviados, f.agendas,
       f.asistencias,
       case when f.agendas > 0 then f.asistencias::numeric / f.agendas end as pct_asistencia,
       ag.no_show,
       case when f.agendas > 0 then ag.no_show::numeric / f.agendas end as pct_no_show,
       ag.reservas, f.cierres as ventas, f.ofertas,
       case when f.agendas > 0 then f.cierres::numeric / f.agendas end as pct_cierre_total,
       case when f.asistencias > 0 then f.cierres::numeric / f.asistencias end as pct_cierre_asistencia,
       case when f.ofertas > 0 then f.cierres::numeric / f.ofertas end as pct_cierre_oferta,
       f.ventas_usd - coalesce(ads.inversion_ads,0) - coalesce(aj.costo_software,0) as cash_collected,
       f.ventas_usd as revenue,
       coalesce(cash.new_cash,0) as new_cash, coalesce(cash.old_cash,0) as old_cash,
       case when f.conversaciones > 0 then f.agendas::numeric / f.conversaciones end as pct_agenda_conversacion,
       case when st.links_enviados > 0 then f.agendas::numeric / st.links_enviados end as pct_agenda_link,
       coalesce(ads.inversion_ads,0) as inversion_ads, aj.costo_software
from f left join ag using (mes) left join st using (mes) left join ads using (mes) left join aj using (mes) left join cash using (mes);

create or replace view v_closer_mes as
select date_trunc('month', fecha_llamada at time zone 'America/Argentina/Buenos_Aires')::date as mes, closer,
       count(*) as agendas,
       count(*) filter (where asistio = 'Asistió') as asistencias,
       case when count(*) > 0 then (count(*) filter (where asistio = 'Asistió'))::numeric / count(*) end as pct_show,
       count(*) filter (where oferta_hecha) as ofertas,
       count(*) filter (where compro in ('Si','Reserva')) as cierres,
       case when count(*) filter (where oferta_hecha) > 0 then (count(*) filter (where compro in ('Si','Reserva')))::numeric / (count(*) filter (where oferta_hecha)) end as pct_cierre,
       coalesce(sum(cash_collected) filter (where compro in ('Si','Reserva')),0) as cash,
       coalesce(sum(revenue) filter (where compro in ('Si','Reserva')),0) as revenue
from agendas group by 1, 2;

create or replace view v_top_organico_mes as
select * from (
  select date_trunc('month', fecha)::date as mes, 'historia_respuestas' as ranking, ig_media_id, titulo, fecha, respuestas as valor,
         row_number() over (partition by date_trunc('month', fecha) order by respuestas desc nulls last) as pos
  from organico_piezas where tipo = 'historia' and not promocionado
  union all
  select date_trunc('month', fecha)::date, 'reel_comentarios', ig_media_id, titulo, fecha, comentarios,
         row_number() over (partition by date_trunc('month', fecha) order by comentarios desc nulls last)
  from organico_piezas where tipo = 'reel' and not promocionado
  union all
  select date_trunc('month', fecha)::date, 'reel_views', ig_media_id, titulo, fecha, views,
         row_number() over (partition by date_trunc('month', fecha) order by views desc nulls last)
  from organico_piezas where tipo = 'reel' and not promocionado
) t where pos <= 5;

create or replace view v_cobranzas_pendientes as
select distinct on (c.agenda_id)
       c.agenda_id, l.nombre, c.closer, c.pendiente, c.cuotas_restantes, c.proximo_vencimiento, c.fecha_cobro as ultimo_cobro
from cobranzas c
join agendas a on a.id = c.agenda_id
join leads l on l.id = a.lead_id
where c.pendiente > 0
order by c.agenda_id, c.fecha_cobro desc;

-- ───────────────────────── RLS ─────────────────────────
-- Hasta que haya login: solo el service role escribe, anon lee.
do $$
declare t text;
begin
  foreach t in array array['leads','agendas','cobranzas','setter_diario','ads_diario','organico_diario','organico_piezas','ajustes_mensuales','log_agente'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_anon_lee on %I', t, t);
    execute format('create policy %I_anon_lee on %I for select to anon using (true)', t, t);
  end loop;
end $$;
