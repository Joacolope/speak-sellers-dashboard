-- Mensajes de Instagram según Meta Business Suite (Bandeja de entrada → Estadísticas), por período.
-- Se puede cargar cualquier rango (una semana, 28 días…): "semana" pasa a ser la fecha de inicio y "hasta" la de fin.
alter table respuesta_semanal drop constraint if exists respuesta_semanal_semana_check;
alter table respuesta_semanal add column if not exists hasta date;
alter table respuesta_semanal add column if not exists contactos int check (contactos >= 0);          -- contactos totales
alter table respuesta_semanal add column if not exists contactos_nuevos int check (contactos_nuevos >= 0);
alter table respuesta_semanal add column if not exists conv_organicas int check (conv_organicas >= 0);
alter table respuesta_semanal add column if not exists conv_pagadas int check (conv_pagadas >= 0);
-- conversaciones = "Conversaciones con mensajes iniciadas"; pct_respuesta = "Índice de respuesta"; tr_promedio_min = "Tiempo de respuesta"
update respuesta_semanal set hasta = semana + 6 where hasta is null;
do $$ begin
  alter table respuesta_semanal add constraint respuesta_semanal_rango check (hasta is null or hasta >= semana);
exception when duplicate_object then null; end $$;
