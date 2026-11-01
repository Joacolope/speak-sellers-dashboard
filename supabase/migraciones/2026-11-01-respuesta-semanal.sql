-- Tiempo de respuesta semanal, copiado de Meta Business Suite (Bandeja de entrada → Estadísticas).
-- Meta no deja leer los DMs por API sin "acceso avanzado", pero Business Suite ya calcula estos números.
-- Una fila por semana (lunes). El dashboard calcula el promedio del mes ponderado por conversaciones.
create table if not exists respuesta_semanal (
  semana date primary key check (extract(isodow from semana) = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source source_t not null default 'manual',
  tr_promedio_min numeric(8,1) check (tr_promedio_min >= 0),   -- tiempo de respuesta promedio 24/7
  tr_horario_min numeric(8,1) check (tr_horario_min >= 0),     -- en horario de atención (si Business Suite lo muestra)
  pct_respuesta numeric(5,4) check (pct_respuesta between 0 and 1),
  conversaciones int check (conversaciones >= 0),             -- conversaciones nuevas de la semana
  notas text,
  editado_por text
);

drop trigger if exists respuesta_semanal_updated_at on respuesta_semanal;
create trigger respuesta_semanal_updated_at before update on respuesta_semanal for each row execute function set_updated_at();

alter table respuesta_semanal enable row level security;
alter table respuesta_semanal force row level security;
drop policy if exists respuesta_semanal_lectura_permitidos on respuesta_semanal;
create policy respuesta_semanal_lectura_permitidos on respuesta_semanal for select to authenticated using (es_usuario_permitido());
