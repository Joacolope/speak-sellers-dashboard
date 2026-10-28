-- Speak Sellers Dashboard · schema de Supabase
-- Se aplica solo en cada deploy (scripts/db-setup.mjs). También se puede pegar
-- en el SQL Editor. Idempotente: correrlo de nuevo no rompe ni borra nada.
--
-- Seguridad:
--  · Nadie anónimo lee ni escribe (se revocan permisos a anon).
--  · Usuarios logueados con Google leen SOLO si su email está en `usuarios` y activo.
--  · Escribir solo lo hace el servidor (service role) después de verificar el rol.
--  · Las vistas respetan RLS (security_invoker).

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
do $$ begin
  create type frecuencia_costo_t as enum ('Mensual','Anual','Único');
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

-- % de comisión de cada closer sobre lo cobrado (neto de reembolsos).
-- Un cambio de % cierra la fila vieja (fecha_baja) y abre una nueva.
create table if not exists comisiones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  notas text,
  closer closer_t not null,
  porcentaje numeric(5,2) not null check (porcentaje >= 0 and porcentaje <= 100),
  fecha_alta date not null default current_date,
  fecha_baja date,
  editado_por text,
  check (fecha_baja is null or fecha_baja >= fecha_alta)
);

-- Comisión de cada plataforma de pago: % sobre cada cobro + fijo por cobro (USD), con historial.
create table if not exists comisiones_plataformas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  notas text,
  plataforma text not null check (plataforma in ('Stripe','Wise','Cripto','Efectivo','Mercado Pago','DólarApp','Otro')),
  porcentaje numeric(5,2) not null check (porcentaje >= 0 and porcentaje <= 100),
  fijo numeric(10,2) not null default 0 check (fijo >= 0),
  fecha_alta date not null default current_date,
  fecha_baja date,
  editado_por text,
  check (fecha_baja is null or fecha_baja >= fecha_alta)
);

-- Comisiones iniciales (se cargan una sola vez, si la tabla está vacía).
-- Marcos es el dueño: 0 %. Andrea y Gonzalo: 10 % sobre lo cobrado. Se cambian desde Costos.
insert into comisiones (closer, porcentaje, fecha_alta, notas, source)
select v.closer::closer_t, v.pct, date '2026-08-01', 'Carga inicial', 'manual'
from (values ('Marcos', 0), ('Andrea', 10), ('Gonzalo', 10)) as v(closer, pct)
where not exists (select 1 from comisiones);

-- Webinars: registrados y asistentes de cada uno (para el embudo de Webinar).
create table if not exists webinars (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  notas text,
  fecha date not null unique,
  nombre text,
  registrados int check (registrados >= 0),
  asistentes int check (asistentes >= 0),
  editado_por text
);
-- Dato real conocido: webinar del 4/10 con 975 registrados (asistentes sin cargar).
insert into webinars (fecha, nombre, registrados, source) values ('2026-10-04', 'Webinar 4/10', 975, 'migracion')
on conflict (fecha) do nothing;

-- Quién puede entrar. El login es con Google; si el email no está acá (o está
-- inactivo) no ve nada. admin y editor cargan datos; lector solo mira.
create table if not exists usuarios (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  nombre text,
  rol text not null default 'lector' check (rol in ('admin','editor','lector')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ultimo_ingreso timestamptz
);

-- Usuarios autorizados (se agregan si no están; no se pisa un rol cambiado a mano).
insert into usuarios (email, nombre, rol) values
  ('joacolope609@gmail.com', 'Joaquín López', 'admin'),
  ('joaquin@salesspawn.com', 'Joaquín López', 'admin'),
  ('marcoslanciventas@gmail.com', 'Marcos Lanci', 'editor')
on conflict (email) do nothing;
-- Marcos pasó de lector a editor (puede cargar datos)
update usuarios set rol = 'editor' where email = 'marcoslanciventas@gmail.com' and rol = 'lector';

-- Software y costos fijos. Cuenta desde fecha_alta hasta fecha_baja (incluida).
-- Anual = monto/12 por mes. Único = entero en el mes de fecha_alta.
-- Un cambio de precio cierra la fila vieja y abre una nueva (historial intacto).
create table if not exists costos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  notas text,
  nombre text not null,
  categoria text not null default 'Otro',
  frecuencia frecuencia_costo_t not null default 'Mensual',
  monto numeric(12,2) not null check (monto >= 0),
  fecha_alta date not null default current_date,
  fecha_baja date,
  check (fecha_baja is null or fecha_baja >= fecha_alta)
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

-- Costos reales confirmados por Joaco (se cargan una sola vez; después se editan en Costos).
insert into costos (nombre, categoria, frecuencia, monto, fecha_alta, notas, source)
select v.nombre, 'CRM y ventas', 'Mensual', v.monto, date '2026-10-01', v.notas, 'manual'
from (values
  ('GoHighLevel', 97::numeric, 'Plan base'),
  ('GoHighLevel · integración WhatsApp', 30::numeric, 'Add-on de WhatsApp')
) as v(nombre, monto, notas)
where not exists (select 1 from costos c where c.nombre = v.nombre);

-- Tarifas de plataformas de cobro (se cargan una sola vez, si la tabla está vacía).
-- Stripe, cuenta de EE. UU. (LLC Wyoming), tarjetas de afuera: 2,9 % + 1,5 % internacional = 4,4 % + 0,30 USD.
--   (+1 % si se cobra en una moneda que no es USD). Wise: recibir USD por ACH no tiene costo
--   (un wire entrante cuesta ~6,11 USD fijo). Mercado Pago por transferencia, DólarApp, efectivo y cripto: 0.
insert into comisiones_plataformas (plataforma, porcentaje, fijo, fecha_alta, notas, source)
select v.plataforma, v.pct, v.fijo, date '2026-08-01', v.notas, 'manual'
from (values
  ('Stripe', 4.4::numeric, 0.30::numeric, 'Cuenta US: 2,9 % + 1,5 % por tarjeta internacional + 0,30 USD'),
  ('Wise', 0, 0, 'Recibir USD por ACH: sin costo. Wire entrante: ~6,11 USD'),
  ('Mercado Pago', 0, 0, 'Transferencia: sin comisión'),
  ('DólarApp', 0, 0, 'Sin comisión'),
  ('Efectivo', 0, 0, null),
  ('Cripto', 0, 0, 'Sin comisión (salvo costo de red, si aplica)')
) as v(plataforma, pct, fijo, notas)
where not exists (select 1 from comisiones_plataformas);

-- Auditoría: quién hizo cada carga manual (email o "token:claude")
alter table leads add column if not exists editado_por text;
-- Por dónde entró cada cobro
alter table cobranzas add column if not exists plataforma text check (plataforma in ('Stripe','Wise','Cripto','Efectivo','Mercado Pago','DólarApp','Otro'));
-- Funnel por el que entró el lead (para los embudos por fuente)
-- Orgánico (incluye Follow Me Ads), Webinar o YouTube. Valores viejos se leen como Orgánico.
alter table leads add column if not exists funnel text;
alter table leads drop constraint if exists leads_funnel_check;
alter table leads add constraint leads_funnel_check check (funnel in ('Orgánico','Webinar','YouTube','Follow Me Ads','Lead magnet'));
-- UTMs del link por el que agendó (atribución de GoHighLevel)
alter table leads add column if not exists utm_source text;
alter table leads add column if not exists utm_medium text;
alter table leads add column if not exists utm_campaign text;
alter table leads add column if not exists utm_content text;
alter table leads add column if not exists utm_term text;
alter table setter_diario add column if not exists editado_por text;
-- Inbound (el lead escribió primero) u Outbound (salió de un mensaje en frío)
alter table leads add column if not exists canal text not null default 'Inbound' check (canal in ('Inbound','Outbound'));
alter table agendas add column if not exists editado_por text;
alter table cobranzas add column if not exists editado_por text;
alter table costos add column if not exists editado_por text;
alter table ajustes_mensuales add column if not exists editado_por text;

-- ───────────────────────── updated_at automático ─────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['leads','agendas','cobranzas','setter_diario','ads_diario','organico_diario','organico_piezas','ajustes_mensuales','costos','comisiones','comisiones_plataformas','webinars','usuarios','log_agente'] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ───────────────────────── Costos por mes ─────────────────────────
-- Software del mes (USD). Si no hay ningún costo cargado, devuelve null y se usa
-- ajustes_mensuales.costo_software como respaldo.
create or replace function costo_software_mes(p_mes date) returns numeric language sql stable as $$
  select case when not exists (select 1 from costos) then null else round(coalesce(sum(
    case
      when frecuencia = 'Único' then case when date_trunc('month', fecha_alta) = date_trunc('month', p_mes) then monto else 0 end
      when fecha_alta <= (date_trunc('month', p_mes) + interval '1 month - 1 day')::date
       and (fecha_baja is null or fecha_baja >= date_trunc('month', p_mes)::date)
        then case when frecuencia = 'Anual' then monto / 12 else monto end
      else 0
    end), 0), 2) end
  from costos
$$;

-- Comisiones del mes: % vigente de cada closer × lo cobrado ese mes por él (neto).
-- null si todavía no se cargó ningún %.
create or replace function comisiones_mes(p_mes date) returns numeric language sql stable as $$
  with cobrado as (
    select closer, sum(monto_cobrado) as base from cobranzas
    where date_trunc('month', fecha_cobro) = date_trunc('month', p_mes)
    group by closer
  ), pct as (
    select distinct on (closer) closer, porcentaje from comisiones
    where fecha_alta <= (date_trunc('month', p_mes) + interval '1 month - 1 day')::date
      and (fecha_baja is null or fecha_baja >= date_trunc('month', p_mes)::date)
    order by closer, fecha_alta desc
  )
  select case when not exists (select 1 from comisiones) then null
    else round(coalesce((select sum(c.base * p.porcentaje / 100) from cobrado c join pct p using (closer)), 0), 2) end
$$;

-- Comisiones de plataformas del mes: % × cobros positivos + fijo × cantidad (los reembolsos no devuelven comisión).
create or replace function comisiones_plataformas_mes(p_mes date) returns numeric language sql stable as $$
  with cobros as (
    select plataforma, sum(monto_cobrado) as bruto, count(*) as n from cobranzas
    where monto_cobrado > 0 and plataforma is not null
      and date_trunc('month', fecha_cobro) = date_trunc('month', p_mes)
    group by plataforma
  ), tarifa as (
    select distinct on (plataforma) plataforma, porcentaje, fijo from comisiones_plataformas
    where fecha_alta <= (date_trunc('month', p_mes) + interval '1 month - 1 day')::date
      and (fecha_baja is null or fecha_baja >= date_trunc('month', p_mes)::date)
    order by plataforma, fecha_alta desc
  )
  select case when not exists (select 1 from comisiones_plataformas) then null
    else round(coalesce((select sum(c.bruto * t.porcentaje / 100 + t.fijo * c.n) from cobros c join tarifa t using (plataforma)), 0), 2) end
$$;

create or replace view v_costos_mes with (security_invoker = true) as
select m.mes::date as mes, costo_software_mes(m.mes::date) as software, comisiones_mes(m.mes::date) as comisiones,
       comisiones_plataformas_mes(m.mes::date) as plataformas
from generate_series(date_trunc('month', now()) - interval '24 months', date_trunc('month', now()) + interval '1 month', interval '1 month') as m(mes);

-- ───────────────────────── Vistas ─────────────────────────
-- Todo se calcula, nada se tipea.

create or replace view v_funnel_mes with (security_invoker = true) as
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

create or replace view v_metricas_mes with (security_invoker = true) as
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
aj as (
  select f.mes, coalesce(costo_software_mes(f.mes), a.costo_software) as costo_software, comisiones_mes(f.mes) as comisiones,
         comisiones_plataformas_mes(f.mes) as plataformas
  from v_funnel_mes f left join ajustes_mensuales a on a.mes = f.mes
),
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
       f.ventas_usd - coalesce(ads.inversion_ads,0) - coalesce(aj.costo_software,0) - coalesce(aj.comisiones,0) - coalesce(aj.plataformas,0) as cash_collected,
       f.ventas_usd as revenue,
       coalesce(cash.new_cash,0) as new_cash, coalesce(cash.old_cash,0) as old_cash,
       case when f.conversaciones > 0 then f.agendas::numeric / f.conversaciones end as pct_agenda_conversacion,
       case when st.links_enviados > 0 then f.agendas::numeric / st.links_enviados end as pct_agenda_link,
       coalesce(ads.inversion_ads,0) as inversion_ads, aj.costo_software, aj.comisiones, aj.plataformas as comisiones_plataformas
from f left join ag using (mes) left join st using (mes) left join ads using (mes) left join aj using (mes) left join cash using (mes);

create or replace view v_closer_mes with (security_invoker = true) as
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

create or replace view v_top_organico_mes with (security_invoker = true) as
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

create or replace view v_cobranzas_pendientes with (security_invoker = true) as
select distinct on (c.agenda_id)
       c.agenda_id, l.nombre, c.closer, c.pendiente, c.cuotas_restantes, c.proximo_vencimiento, c.fecha_cobro as ultimo_cobro
from cobranzas c
join agendas a on a.id = c.agenda_id
join leads l on l.id = a.lead_id
where c.pendiente > 0
order by c.agenda_id, c.fecha_cobro desc;

-- ───────────────────────── RLS y permisos ─────────────────────────
-- ¿El usuario logueado (JWT de Supabase Auth) está en la lista y activo?
create or replace function es_usuario_permitido() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and activo
  )
$$;

do $$
declare t text;
begin
  foreach t in array array['leads','agendas','cobranzas','setter_diario','ads_diario','organico_diario','organico_piezas','ajustes_mensuales','costos','comisiones','comisiones_plataformas','webinars','log_agente'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists %I_anon_lee on %I', t, t);           -- política vieja, insegura
    execute format('drop policy if exists %I_lectura_permitidos on %I', t, t);
    execute format('create policy %I_lectura_permitidos on %I for select to authenticated using (es_usuario_permitido())', t, t);
  end loop;
end $$;

alter table usuarios enable row level security;
alter table usuarios force row level security;
drop policy if exists usuarios_ve_su_fila on usuarios;
create policy usuarios_ve_su_fila on usuarios for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Sin acceso anónimo; los logueados solo leen (RLS filtra); escribir es solo del servidor.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
revoke all on function es_usuario_permitido() from public, anon;
grant execute on function es_usuario_permitido() to authenticated;
revoke all on function costo_software_mes(date) from public, anon;
grant execute on function costo_software_mes(date) to authenticated;
revoke all on function comisiones_mes(date) from public, anon;
grant execute on function comisiones_mes(date) to authenticated;
revoke all on function comisiones_plataformas_mes(date) from public, anon;
grant execute on function comisiones_plataformas_mes(date) to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
